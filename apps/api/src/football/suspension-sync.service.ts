import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  countYellowCardsByPerson,
  playersSuspendedByYellows,
} from '../reglamento/reglamento.engine';
import {
  findYellowThresholdMatch,
  inferInitialFechas,
  remainingFechas,
  sanctionsFromMatchEvents,
  scoreFromGoalEvents,
} from './suspension.engine';

const AUTO_MOTIVOS = [
  'Tarjeta roja directa',
  'Expulsión directa',
  'Doble amarilla',
  '5 amarillas acumuladas',
] as const;

@Injectable()
export class SuspensionSyncService {
  constructor(private prisma: PrismaService) {}

  async syncAfterEventChange(partidoId: string): Promise<void> {
    const partido = await this.prisma.partidoFutbol.findUnique({
      where: { id: partidoId },
      select: { id: true, torneoId: true },
    });
    if (!partido?.torneoId) return;

    await this.syncMatchSanctions(partidoId, partido.torneoId);
    await this.syncYellowAccumulation(partido.torneoId);
    await this.recalcRemainingForTorneo(partido.torneoId);
    await this.syncScoreFromEvents(partidoId);
  }

  async syncAfterMatchPlayed(partidoId: string): Promise<void> {
    const partido = await this.prisma.partidoFutbol.findUnique({
      where: { id: partidoId },
      select: { torneoId: true },
    });
    if (!partido?.torneoId) return;
    await this.recalcRemainingForTorneo(partido.torneoId);
  }

  async syncTorneo(torneoId: string): Promise<{ updated: number }> {
    const partidos = await this.prisma.partidoFutbol.findMany({
      where: { torneoId },
      select: { id: true },
    });

    for (const p of partidos) {
      await this.syncMatchSanctions(p.id, torneoId);
    }
    await this.syncYellowAccumulation(torneoId);
    await this.recalcRemainingForTorneo(torneoId);
    return { updated: partidos.length };
  }

  private async syncMatchSanctions(partidoId: string, torneoId: string): Promise<void> {
    const events = await this.prisma.eventoPartido.findMany({
      where: { partidoId },
      select: { personaId: true, tipo: true },
    });

    const drafts = sanctionsFromMatchEvents(partidoId, events);
    const draftKeys = new Set(drafts.map((d) => `${d.personaId}:${d.motivo}`));

    for (const draft of drafts) {
      const existing = await this.prisma.suspension.findFirst({
        where: {
          personaId: draft.personaId,
          origenPartidoId: partidoId,
          motivo: draft.motivo,
          torneoId,
        },
      });

      if (existing) {
        await this.prisma.suspension.update({
          where: { id: existing.id },
          data: {
            activa: true,
            fechasRestantes: draft.fechasIniciales,
          },
        });
      } else {
        await this.prisma.suspension.create({
          data: {
            personaId: draft.personaId,
            torneoId,
            motivo: draft.motivo,
            fechasRestantes: draft.fechasIniciales,
            origenPartidoId: partidoId,
            activa: true,
          },
        });
      }
    }

    const stale = await this.prisma.suspension.findMany({
      where: {
        origenPartidoId: partidoId,
        torneoId,
        motivo: { in: [...AUTO_MOTIVOS.filter((m) => m !== '5 amarillas acumuladas')] },
      },
    });

    for (const row of stale) {
      const key = `${row.personaId}:${row.motivo}`;
      if (!draftKeys.has(key)) {
        await this.prisma.suspension.update({
          where: { id: row.id },
          data: { activa: false, fechasRestantes: 0 },
        });
      }
    }
  }

  private async syncYellowAccumulation(torneoId: string): Promise<void> {
    const partidoIds = (
      await this.prisma.partidoFutbol.findMany({
        where: { torneoId },
        select: { id: true },
      })
    ).map((p) => p.id);

    if (!partidoIds.length) return;

    const rawEvents = await this.prisma.eventoPartido.findMany({
      where: { partidoId: { in: partidoIds } },
      include: { partido: { select: { date: true } } },
    });

    const events = rawEvents.map((e) => ({
      partidoId: e.partidoId,
      personaId: e.personaId,
      tipo: e.tipo,
      matchDate: e.partido.date,
    }));

    const counts = countYellowCardsByPerson(
      rawEvents.map((e) => ({ personaId: e.personaId, tipo: e.tipo })),
    );
    const suspendedPersonas = new Set(playersSuspendedByYellows(counts, 5));

    for (const personaId of suspendedPersonas) {
      const origenPartidoId = findYellowThresholdMatch(personaId, events, 5);
      if (!origenPartidoId) continue;

      const existing = await this.prisma.suspension.findFirst({
        where: {
          personaId,
          torneoId,
          motivo: '5 amarillas acumuladas',
        },
      });

      if (existing) {
        await this.prisma.suspension.update({
          where: { id: existing.id },
          data: {
            origenPartidoId,
            activa: true,
            fechasRestantes: existing.fechasRestantes > 0 ? existing.fechasRestantes : 1,
          },
        });
      } else {
        await this.prisma.suspension.create({
          data: {
            personaId,
            torneoId,
            motivo: '5 amarillas acumuladas',
            fechasRestantes: 1,
            origenPartidoId,
            activa: true,
          },
        });
      }
    }

    const yellowSuspensions = await this.prisma.suspension.findMany({
      where: { torneoId, motivo: '5 amarillas acumuladas' },
    });

    for (const row of yellowSuspensions) {
      if (!suspendedPersonas.has(row.personaId)) {
        await this.prisma.suspension.update({
          where: { id: row.id },
          data: { activa: false, fechasRestantes: 0 },
        });
      }
    }
  }

  async recalcRemainingForTorneo(torneoId: string): Promise<void> {
    const [suspensions, partidos, inscripciones] = await Promise.all([
      this.prisma.suspension.findMany({
        where: { torneoId, activa: true, origenPartidoId: { not: null } },
      }),
      this.prisma.partidoFutbol.findMany({
        where: { torneoId, status: { in: ['jugado', 'wo'] } },
        include: { jornada: true },
      }),
      this.prisma.inscripcionJugador.findMany({
        where: { torneoId, activa: true },
        select: { personaId: true, equipoInscripcion: { select: { equipoId: true } } },
      }),
    ]);

    const teamByPersona = new Map(
      inscripciones.map((i) => [i.personaId, i.equipoInscripcion.equipoId]),
    );

    const partidoById = new Map(partidos.map((p) => [p.id, p]));

    for (const susp of suspensions) {
      if (!susp.origenPartidoId) continue;

      const sanctionMatch = partidoById.get(susp.origenPartidoId)
        ?? (await this.prisma.partidoFutbol.findUnique({
          where: { id: susp.origenPartidoId },
          include: { jornada: true },
        }));

      if (!sanctionMatch) continue;

      const teamId = teamByPersona.get(susp.personaId);
      if (!teamId) continue;

      const playedAfter = partidos.filter(
        (m) =>
          m.id !== susp.origenPartidoId &&
          m.date > sanctionMatch.date &&
          !m.jornada?.suspendida &&
          (m.homeTeamId === teamId || m.awayTeamId === teamId),
      ).length;

      const initial = inferInitialFechas(susp.motivo);
      const remaining = remainingFechas(initial, playedAfter);

      await this.prisma.suspension.update({
        where: { id: susp.id },
        data: {
          fechasRestantes: remaining,
          activa: remaining > 0,
        },
      });
    }
  }

  private async syncScoreFromEvents(partidoId: string): Promise<void> {
    const partido = await this.prisma.partidoFutbol.findUnique({
      where: { id: partidoId },
      select: {
        id: true,
        torneoId: true,
        homeInscripcionId: true,
        awayInscripcionId: true,
        homeTeamId: true,
        awayTeamId: true,
      },
    });
    if (!partido?.torneoId) return;

    const events = await this.prisma.eventoPartido.findMany({
      where: { partidoId },
      select: { personaId: true, tipo: true },
    });

    const rosterFilter = (inscripcionId: string | null, teamId: string) =>
      inscripcionId
        ? { torneoId: partido.torneoId!, activa: true, equipoInscripcionId: inscripcionId }
        : {
            torneoId: partido.torneoId!,
            activa: true,
            equipoInscripcion: { equipoId: teamId },
          };

    const [homeRoster, awayRoster] = await Promise.all([
      this.prisma.inscripcionJugador.findMany({
        where: rosterFilter(partido.homeInscripcionId, partido.homeTeamId),
        select: { personaId: true },
      }),
      this.prisma.inscripcionJugador.findMany({
        where: rosterFilter(partido.awayInscripcionId, partido.awayTeamId),
        select: { personaId: true },
      }),
    ]);

    const homePersonaIds = new Set(homeRoster.map((r) => r.personaId));
    const awayPersonaIds = new Set(awayRoster.map((r) => r.personaId));
    const { homeGoals, awayGoals } = scoreFromGoalEvents(events, homePersonaIds, awayPersonaIds);

    await this.prisma.partidoFutbol.update({
      where: { id: partidoId },
      data: { homeGoals, awayGoals },
    });
  }
}
