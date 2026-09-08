import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

/**
 * Equipo inscripto mínimo necesario para armar cruces (round-robin circle
 * method). Se usa un tipo genérico para poder reutilizar la función tanto
 * con el resultado "liviano" de un `findMany` simple como con variantes que
 * incluyan más relaciones (`equipo`, etc.).
 */
export interface RoundRobinTeam {
  id: string;
  equipoId: string;
}

export interface RoundPairsResult<T extends RoundRobinTeam> {
  pairs: [T, T][];
  /** Inscripción que quedó libre en esta ronda (null si la cantidad de equipos es par). */
  byeInscripcionId: string | null;
}

/**
 * Arma los cruces de una ronda de round-robin (circle method) para una
 * cantidad arbitraria de equipos. Si la cantidad es impar se agrega un
 * sentinela `__bye__` que queda descartado de los pares, pero se informa
 * en `byeInscripcionId` cuál fue el equipo real que quedó emparejado con
 * ese sentinela (el que queda libre esa ronda).
 *
 * Función pura, sin dependencias de Prisma/Nest — se puede testear o
 * reutilizar libremente.
 */
export function buildRoundPairs<T extends RoundRobinTeam>(
  teams: T[],
  roundIndex: number,
): RoundPairsResult<T> {
  const list = [...teams];
  if (list.length < 2) return { pairs: [], byeInscripcionId: null };

  if (list.length % 2 === 1) {
    list.push({ id: '__bye__', equipoId: '__bye__' } as T);
  }

  const rotated = [...list];
  for (let r = 0; r < roundIndex % (rotated.length - 1); r++) {
    const fixed = rotated[0];
    const tail = rotated.slice(1);
    const last = tail.pop()!;
    rotated.splice(0, rotated.length, fixed, last, ...tail);
  }

  const half = rotated.length / 2;
  const pairs: [T, T][] = [];
  let byeInscripcionId: string | null = null;
  for (let i = 0; i < half; i++) {
    const home = rotated[i];
    const away = rotated[rotated.length - 1 - i];
    if (home.id === '__bye__') {
      byeInscripcionId = away.id;
    } else if (away.id === '__bye__') {
      byeInscripcionId = home.id;
    } else {
      pairs.push([home, away]);
    }
  }
  return { pairs, byeInscripcionId };
}

/**
 * Cliente Prisma mínimo que necesita `createMatchesForPairs` — así puede
 * recibir tanto `PrismaService` como el `tx` dentro de `prisma.$transaction`.
 */
type PartidoWriter = Pick<Prisma.TransactionClient, 'partidoFutbol'>;

/**
 * Crea los `PartidoFutbol` para una lista de cruces ya armada (por
 * `buildRoundPairs` o invertidos para la revancha). Comparte la misma
 * forma de creación que antes vivía inline en
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

  /**
   * Genera TODA la temporada de un torneo de una sola vez: `fechas` rondas
   * a partir de `fechaInicio` (una por semana), rotando el equipo libre y
   * repitiendo los cruces como revancha (local/visitante invertido) una
   * vez que se completa una vuelta entera. Falla si el torneo ya tiene
   * jornadas cargadas (para no mezclar con carga manual) o si hay menos
   * de 2 inscripciones activas. Todo dentro de una transacción.
   */
  async generateFullSeason(torneoId: string, fechas: number, fechaInicio: string) {
    return this.prisma.$transaction(async (tx) => {
      const torneo = await tx.torneo.findUnique({ where: { id: torneoId } });
      if (!torneo) throw new NotFoundException('Torneo no encontrado');

      const existingJornadas = await tx.jornada.count({ where: { torneoId } });
      if (existingJornadas > 0) {
        throw new BadRequestException(
          'El torneo ya tiene jornadas cargadas; la generación de fixture completo solo funciona sobre un torneo sin jornadas previas',
        );
      }

      const inscripciones = await tx.equipoInscripcion.findMany({
        where: { torneoId, activo: true },
        include: { equipo: true },
      });
      if (inscripciones.length < 2) {
        throw new BadRequestException('Se necesitan al menos 2 equipos inscriptos');
      }

      const n = inscripciones.length;
      const cycleLength = n % 2 === 0 ? n - 1 : n;

      const jornadasCreadas: { id: string; numero: number; fecha: Date; equipoLibreId: string | null }[] =
        [];

      for (let f = 0; f < fechas; f++) {
        const cyclePosition = f % cycleLength;
        const { pairs, byeInscripcionId } = buildRoundPairs(inscripciones, cyclePosition);

        const invert = Math.floor(f / cycleLength) % 2 === 1;
        const finalPairs = invert
          ? pairs.map(([home, away]) => [away, home] as [(typeof pairs)[number][0], (typeof pairs)[number][1]])
          : pairs;

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
          pairs: finalPairs,
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
      };
    });
  }
}
