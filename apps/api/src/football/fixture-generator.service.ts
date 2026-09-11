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
