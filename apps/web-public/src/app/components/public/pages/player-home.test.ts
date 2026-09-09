import { describe, it, expect } from 'vitest';
import { playerHomeSections } from './player-home';
import type { MeContext } from '../../../api/public-api';

const ctxJugador: MeContext = {
  user: {} as never,
  equipo: { name: 'Los Halcones', categoria: 'Libre A' },
  proximoPartido: { id: 'm1', fecha: '2026-09-12', hora: '14:00', cancha: 'C1', local: 'Los Halcones', visitante: 'Depredadores FC', esLocal: true },
  standingsPosition: { inscripcionId: 'ei-halcones', teamName: 'Los Halcones', played: 8, points: 14 } as never,
  personalStats: { goles: 3, amarillas: 1, rojas: 0, suspensiones: [] },
  tieneStatsPersonales: true,
};

describe('playerHomeSections', () => {
  it('anónimo/usuario → torneo genérico sin resaltar, sin stats ni próximo partido', () => {
    const s = playerHomeSections('usuario', null);
    expect(s).toMatchObject({
      showTorneoGenerico: true, showMiProximoPartido: false, showStatsStrip: false,
      showEmailMismatch: false, teamLabel: null, highlightTeamId: null,
    });
  });
  it('usuario con dniEnPlantelOtroEmail → muestra el aviso', () => {
    expect(playerHomeSections('usuario', null, 'Los Halcones').showEmailMismatch).toBe(true);
  });
  it('seguidor → próximo partido + highlight, sin stats', () => {
    const s = playerHomeSections('seguidor', { ...ctxJugador, personalStats: null });
    expect(s.showMiProximoPartido).toBe(true);
    expect(s.showStatsStrip).toBe(false);
    expect(s.highlightTeamId).toBe('ei-halcones');
  });
  it('jugador → todo', () => {
    const s = playerHomeSections('jugador', ctxJugador);
    expect(s).toMatchObject({
      showMiProximoPartido: true, showStatsStrip: true,
      teamLabel: 'Los Halcones · Libre A', highlightTeamId: 'ei-halcones',
    });
  });
});
