import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  applyWalkoverResult,
  computeStandings,
  countYellowCardsByPerson,
  playersSuspendedByYellows,
} from './reglamento.engine';

@Injectable()
export class ReglamentoEngineService {
  constructor(private prisma: PrismaService) {}

  async getStandingsForTorneo(torneoId: string) {
    const [inscripciones, partidos, config] = await Promise.all([
      this.prisma.equipoInscripcion.findMany({
        where: { torneoId, activo: true },
        include: { equipo: true },
      }),
      this.prisma.partidoFutbol.findMany({
        where: { torneoId },
      }),
      this.prisma.torneoConfig.findUnique({ where: { torneoId } }),
    ]);

    const meta = inscripciones.map((i) => ({
      id: i.id,
      teamId: i.equipoId,
      teamName: i.equipo.name,
      descuentoPuntosWO: i.descuentoPuntosWO,
    }));

    const rules = config
      ? {
          puntosVictoria: config.puntosVictoria,
          puntosEmpate: config.puntosEmpate,
          puntosDerrota: config.puntosDerrota,
          criteriosDesempate: config.criteriosDesempate as string[],
        }
      : undefined;

    return computeStandings(meta, partidos, rules);
  }

  walkover(ganadorEsLocal: boolean) {
    return applyWalkoverResult(ganadorEsLocal);
  }

  async getYellowCardSuspensions(torneoId: string, threshold = 5) {
    const partidoIds = (
      await this.prisma.partidoFutbol.findMany({
        where: { torneoId },
        select: { id: true },
      })
    ).map((p) => p.id);

    const events = await this.prisma.eventoPartido.findMany({
      where: { partidoId: { in: partidoIds } },
      select: { personaId: true, tipo: true },
    });

    const counts = countYellowCardsByPerson(events);
    return playersSuspendedByYellows(counts, threshold);
  }
}
