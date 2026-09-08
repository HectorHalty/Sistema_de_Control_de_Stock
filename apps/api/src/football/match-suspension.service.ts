import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class MatchSuspensionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Suspende una jornada completa por lluvia: crea (o reutiliza, si ya
   * existe) una jornada de recuperación +7 días y mueve ahí los partidos
   * `pendiente` de la jornada original. Los partidos ya `jugado` quedan
   * como están. Movido tal cual desde `FootballService` — mismo
   * comportamiento, ruta `POST jornadas/:id/suspend-rain` sin cambios.
   */
  async suspendJornadaPorLluvia(jornadaId: string) {
    const jornada = await this.prisma.jornada.findUnique({
      where: { id: jornadaId },
      include: { torneo: true },
    });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    if (jornada.suspendida) {
      throw new ConflictException('La jornada ya está suspendida');
    }

    const pendingMatches = await this.prisma.partidoFutbol.findMany({
      where: { jornadaId, status: 'pendiente' },
    });

    const maxJornada = await this.prisma.jornada.findFirst({
      where: { torneoId: jornada.torneoId },
      orderBy: { numero: 'desc' },
    });
    const nextNumero = (maxJornada?.numero ?? jornada.numero) + 1;
    const recoveryDate = new Date(jornada.fecha);
    recoveryDate.setDate(recoveryDate.getDate() + 7);

    const recovery = await this.prisma.$transaction(async (tx) => {
      await tx.jornada.update({
        where: { id: jornadaId },
        data: { suspendida: true, publicada: false },
      });

      const nueva = await tx.jornada.create({
        data: {
          torneoId: jornada.torneoId,
          numero: nextNumero,
          fecha: recoveryDate,
          esRecuperacion: true,
          suspendida: false,
          publicada: false,
        },
      });

      for (const match of pendingMatches) {
        await tx.partidoFutbol.update({
          where: { id: match.id },
          data: {
            jornadaId: nueva.id,
            date: recoveryDate,
            ...(match.bloqueadoManual
              ? {}
              : { canchaId: null, horaInicio: null, venue: null }),
          },
        });
      }

      return nueva;
    });

    return {
      suspendedJornadaId: jornadaId,
      recoveryJornadaId: recovery.id,
      recoveryNumero: recovery.numero,
      recoveryFecha: recovery.fecha.toISOString(),
      movedMatches: pendingMatches.length,
    };
  }

  /**
   * Suspende un partido puntual (no toda la jornada). Marca el original
   * como `suspendido` y crea un partido de recuperación +7 días (desde la
   * fecha de la jornada original, o desde la fecha del propio partido si
   * no tiene jornada), vinculado vía `reemplazaAId`. Si ya existe una
   * jornada de recuperación para ese torneo apuntando a esa misma fecha
   * (por ejemplo por otro partido suspendido individualmente antes), la
   * reutiliza en vez de crear una nueva — mismo criterio de "recuperación
   * compartida" que ya usa `suspendJornadaPorLluvia`.
   */
  async suspendMatch(matchId: string) {
    const match = await this.prisma.partidoFutbol.findUnique({
      where: { id: matchId },
      include: { jornada: true },
    });
    if (!match) throw new NotFoundException('Partido no encontrado');
    if (match.status === 'jugado') {
      throw new BadRequestException('No se puede suspender un partido ya jugado');
    }
    if (!match.torneoId) {
      throw new BadRequestException(
        'El partido no pertenece a ningún torneo, no se puede suspender individualmente',
      );
    }

    const baseDate = match.jornada?.fecha ?? match.date;
    const recoveryDate = new Date(baseDate);
    recoveryDate.setDate(recoveryDate.getDate() + 7);

    const dayStart = new Date(recoveryDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const torneoId = match.torneoId;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.partidoFutbol.update({
        where: { id: matchId },
        data: { status: 'suspendido' },
      });

      let recoveryJornada = await tx.jornada.findFirst({
        where: {
          torneoId,
          esRecuperacion: true,
          fecha: { gte: dayStart, lt: dayEnd },
        },
      });

      if (!recoveryJornada) {
        const maxJornada = await tx.jornada.findFirst({
          where: { torneoId },
          orderBy: { numero: 'desc' },
        });
        const nextNumero = (maxJornada?.numero ?? 0) + 1;
        recoveryJornada = await tx.jornada.create({
          data: {
            torneoId,
            numero: nextNumero,
            fecha: recoveryDate,
            esRecuperacion: true,
            suspendida: false,
            publicada: false,
          },
        });
      }

      const nuevoPartido = await tx.partidoFutbol.create({
        data: {
          torneoId,
          jornadaId: recoveryJornada.id,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeInscripcionId: match.homeInscripcionId,
          awayInscripcionId: match.awayInscripcionId,
          date: recoveryDate,
          status: 'pendiente',
          reemplazaAId: match.id,
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          jornada: true,
        },
      });

      return { recoveryJornada, nuevoPartido };
    });

    return {
      originalMatchId: matchId,
      recoveryJornadaId: result.recoveryJornada.id,
      recoveryFecha: result.recoveryJornada.fecha.toISOString(),
      match: result.nuevoPartido,
    };
  }

  /**
   * Suspende el sábado completo: recorre todas las jornadas (de cualquier
   * torneo/categoría) cuya fecha caiga ese día y que no estén ya
   * suspendidas, y aplica `suspendJornadaPorLluvia` a cada una — mismo
   * comportamiento que suspender una jornada individual, en lote.
   */
  async suspendSaturday(fecha: string) {
    const dayStart = new Date(fecha);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const jornadas = await this.prisma.jornada.findMany({
      where: {
        fecha: { gte: dayStart, lt: dayEnd },
        suspendida: false,
      },
      include: { torneo: { include: { categoria: true } } },
    });

    const detalle: {
      jornadaId: string;
      torneoId: string;
      categoriaNombre: string;
      jornadaRecuperacionId: string;
      movedMatches: number;
    }[] = [];

    for (const jornada of jornadas) {
      const result = await this.suspendJornadaPorLluvia(jornada.id);
      detalle.push({
        jornadaId: jornada.id,
        torneoId: jornada.torneoId,
        categoriaNombre: jornada.torneo.categoria.nombre,
        jornadaRecuperacionId: result.recoveryJornadaId,
        movedMatches: result.movedMatches,
      });
    }

    return {
      fecha,
      jornadasSuspendidas: detalle.length,
      detalle,
    };
  }
}
