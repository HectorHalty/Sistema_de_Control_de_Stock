import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  bergerRoundToPairs,
  buildBergerRounds,
  chooseOffset,
  numberTeams,
  pairKey,
} from './berger';
import { collectCruceWarnings } from './cruce-warnings';

export interface RoundRobinTeam {
  id: string;
  equipoId: string;
}

/**
 * Cliente Prisma mínimo que necesita `createMatchesForPairs` — así puede
 * recibir tanto `PrismaService` como el `tx` dentro de `prisma.$transaction`.
 */
type PartidoWriter = Pick<Prisma.TransactionClient, 'partidoFutbol'>;

/**
 * Crea los `PartidoFutbol` para una lista de cruces ya armada. Comparte
 * la misma forma de creación que antes vivía inline en
 * `FootballService.generateRoundRobin`, para no duplicar el bloque de
 * `prisma.partidoFutbol.create` entre la generación de una sola jornada y
 * la generación de temporada completa.
 */
export async function createMatchesForPairs<T extends RoundRobinTeam>(
  prisma: PartidoWriter,
  params: {
    torneoId: string;
    jornadaId: string;
    date: Date;
    pairs: [T, T][];
  },
  include?: Prisma.PartidoFutbolInclude,
) {
  const created: Awaited<ReturnType<PartidoWriter['partidoFutbol']['create']>>[] = [];
  for (const [home, away] of params.pairs) {
    const partido = await prisma.partidoFutbol.create({
      data: {
        torneoId: params.torneoId,
        jornadaId: params.jornadaId,
        homeTeamId: home.equipoId,
        awayTeamId: away.equipoId,
        homeInscripcionId: home.id,
        awayInscripcionId: away.id,
        date: params.date,
        status: 'pendiente',
      },
      include,
    });
    created.push(partido);
  }
  return created;
}

@Injectable()
export class FixtureGeneratorService {
  constructor(private prisma: PrismaService) {}

  async updateMatchCruces(
    id: string,
    homeInscripcionId: string,
    awayInscripcionId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const partido = await tx.partidoFutbol.findUnique({
        where: { id },
        include: { jornada: true },
      });
      if (!partido) throw new NotFoundException('Partido no encontrado');
      if (homeInscripcionId === awayInscripcionId) {
        throw new BadRequestException('Local y visitante no pueden ser el mismo equipo');
      }
      if (!partido.torneoId || !partido.jornadaId || !partido.jornada) {
        throw new BadRequestException('El partido no pertenece a una jornada de torneo');
      }

      const inscripciones = await tx.equipoInscripcion.findMany({
        where: {
          id: { in: [homeInscripcionId, awayInscripcionId] },
          torneoId: partido.torneoId,
          activo: true,
        },
      });
      if (inscripciones.length !== 2) {
        throw new BadRequestException('Equipo no inscripto en este torneo');
      }

      const inscripcionById = new Map(
        inscripciones.map((inscripcion) => [inscripcion.id, inscripcion]),
      );
      const homeInscripcion = inscripcionById.get(homeInscripcionId)!;
      const awayInscripcion = inscripcionById.get(awayInscripcionId)!;
      const [inscripcionesTorneo, partidosJornada, partidosOtrasJornadas] =
        await Promise.all([
          tx.equipoInscripcion.findMany({
            where: { torneoId: partido.torneoId, activo: true },
            select: { id: true },
          }),
          tx.partidoFutbol.findMany({
            where: { jornadaId: partido.jornadaId },
            select: {
              id: true,
              homeInscripcionId: true,
              awayInscripcionId: true,
            },
          }),
          tx.partidoFutbol.findMany({
            where: {
              torneoId: partido.torneoId,
              jornadaId: { not: partido.jornadaId },
            },
            select: { homeTeamId: true, awayTeamId: true },
          }),
        ]);

      const warnings = collectCruceWarnings({
        matchId: partido.id,
        nuevaHomeInscripcionId: homeInscripcionId,
        nuevaAwayInscripcionId: awayInscripcionId,
        jornadaPublicada: partido.jornada.publicada,
        matchTieneResultado:
          partido.status !== 'pendiente' ||
          partido.homeGoals !== null ||
          partido.awayGoals !== null ||
          partido.esWO,
        inscripcionIdsTorneo: inscripcionesTorneo.map((inscripcion) => inscripcion.id),
        partidosJornada,
        paresOtrasJornadas: partidosOtrasJornadas,
        nuevaHomeTeamId: homeInscripcion.equipoId,
        nuevaAwayTeamId: awayInscripcion.equipoId,
      });

      await tx.partidoFutbol.update({
        where: { id },
        data: {
          homeInscripcionId,
          awayInscripcionId,
          homeTeamId: homeInscripcion.equipoId,
          awayTeamId: awayInscripcion.equipoId,
        },
      });

      const inscripcionesPresentes = new Set<string>();
      for (const partidoJornada of partidosJornada) {
        const ids =
          partidoJornada.id === id
            ? [homeInscripcionId, awayInscripcionId]
            : [
                partidoJornada.homeInscripcionId,
                partidoJornada.awayInscripcionId,
              ];
        for (const inscripcionId of ids) {
          if (inscripcionId) inscripcionesPresentes.add(inscripcionId);
        }
      }
      const ausentes = inscripcionesTorneo.filter(
        (inscripcion) => !inscripcionesPresentes.has(inscripcion.id),
      );
      await tx.jornada.update({
        where: { id: partido.jornadaId },
        data: { equipoLibreId: ausentes.length === 1 ? ausentes[0].id : null },
      });

      const match = await tx.partidoFutbol.findUnique({
        where: { id },
        include: { homeTeam: true, awayTeam: true, jornada: true },
      });
      return { match: match!, warnings };
    });
  }

  async publishFixture(torneoId: string) {
    const jornadas = await this.prisma.jornada.findMany({ where: { torneoId } });
    if (jornadas.length === 0) {
      throw new BadRequestException('No hay jornadas para publicar');
    }
    if (jornadas.some((j) => j.publicada)) {
      throw new BadRequestException('El fixture ya tiene jornadas publicadas');
    }
    const updated = await this.prisma.jornada.updateMany({
      where: { torneoId },
      data: { publicada: true },
    });
    return { torneoId, publicadas: updated.count };
  }

  async generateFullSeason(torneoId: string, fechaInicio: string): Promise<{
    torneoId: string;
    jornadasCreadas: number;
    jornadas: { id: string; numero: number; fecha: Date; equipoLibreId: string | null }[];
    offset: number;
    choques: number;
    torneoReferenciaId: string | null;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const torneo = await tx.torneo.findUnique({
        where: { id: torneoId },
        include: { campeonato: true },
      });
      if (!torneo) throw new NotFoundException('Torneo no encontrado');

      const inscripciones = await tx.equipoInscripcion.findMany({
        where: { torneoId, activo: true },
        include: { equipo: true },
      });
      if (inscripciones.length < 2) {
        throw new BadRequestException('Se necesitan al menos 2 equipos inscriptos');
      }

      const existingJornadas = await tx.jornada.findMany({
        where: { torneoId },
        select: { publicada: true },
      });
      if (existingJornadas.length > 0) {
        const partidoNoRegenerable = await tx.partidoFutbol.findFirst({
          where: {
            torneoId,
            OR: [
              { status: { not: 'pendiente' } },
              { homeGoals: { not: null } },
              { awayGoals: { not: null } },
              { esWO: true },
            ],
          },
          select: { id: true },
        });
        if (existingJornadas.some((jornada) => jornada.publicada) || partidoNoRegenerable) {
          throw new BadRequestException(
            'El torneo ya tiene jornadas cargadas; la generación de fixture completo solo funciona sobre un torneo sin jornadas previas',
          );
        }
        await tx.partidoFutbol.deleteMany({ where: { torneoId } });
        await tx.jornada.deleteMany({ where: { torneoId } });
      }

      const numbered = numberTeams(inscripciones);
      const rounds = buildBergerRounds(numbered.length);
      const torneoReferencia = await tx.torneo.findFirst({
        where: {
          categoriaId: torneo.categoriaId,
          campeonatoId: { not: torneo.campeonatoId },
          campeonato: { temporadaId: torneo.campeonato.temporadaId },
          partidos: { some: {} },
        },
        include: {
          partidos: { include: { jornada: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      let offset = 0;
      let choques = 0;
      let torneoReferenciaId: string | null = null;
      if (torneoReferencia) {
        const previousFechaByPair = new Map(
          torneoReferencia.partidos
            .filter((partido) => partido.jornada !== null)
            .map((partido) => [
              pairKey(partido.homeTeamId, partido.awayTeamId),
              partido.jornada!.numero,
            ]),
        );
        const selected = chooseOffset(
          rounds,
          (teamNumber) => numbered[teamNumber - 1].equipoId,
          previousFechaByPair,
        );
        offset = selected.offset;
        choques = selected.choques;
        torneoReferenciaId = torneoReferencia.id;
      }

      const jornadasCreadas: { id: string; numero: number; fecha: Date; equipoLibreId: string | null }[] =
        [];

      for (let f = 0; f < rounds.length; f++) {
        const round = rounds[(f + offset) % rounds.length];
        const { pairs, byeInscripcionId } = bergerRoundToPairs(round, numbered);
        const matchDate = new Date(fechaInicio);
        matchDate.setDate(matchDate.getDate() + f * 7);

        const jornada = await tx.jornada.create({
          data: {
            torneoId,
            numero: f + 1,
            fecha: matchDate,
            equipoLibreId: byeInscripcionId,
          },
        });

        await createMatchesForPairs(tx, {
          torneoId,
          jornadaId: jornada.id,
          date: matchDate,
          pairs,
        });

        jornadasCreadas.push({
          id: jornada.id,
          numero: jornada.numero,
          fecha: jornada.fecha,
          equipoLibreId: jornada.equipoLibreId,
        });
      }

      return {
        torneoId,
        jornadasCreadas: jornadasCreadas.length,
        jornadas: jornadasCreadas,
        offset,
        choques,
        torneoReferenciaId,
      };
    });
  }
}
