import { describe, expect, it } from 'vitest';
import {
  applyWalkoverResult,
  computeStandings,
  countYellowCardsByPerson,
  playersSuspendedByYellows,
} from '../src/reglamento/reglamento.engine';

describe('ReglamentoEngine', () => {
  const inscripciones = [
    { id: 'ins-a', teamId: 't-a', teamName: 'Equipo A', descuentoPuntosWO: 0 },
    { id: 'ins-b', teamId: 't-b', teamName: 'Equipo B', descuentoPuntosWO: 3 },
    { id: 'ins-c', teamId: 't-c', teamName: 'Equipo C', descuentoPuntosWO: 0 },
  ];

  it('calcula puntos 3/1/0 y desempate por diferencia de goles', () => {
    const standings = computeStandings(inscripciones, [
      {
        status: 'jugado',
        homeInscripcionId: 'ins-a',
        awayInscripcionId: 'ins-b',
        homeTeamId: 't-a',
        awayTeamId: 't-b',
        homeGoals: 2,
        awayGoals: 1,
      },
      {
        status: 'jugado',
        homeInscripcionId: 'ins-c',
        awayInscripcionId: 'ins-a',
        homeTeamId: 't-c',
        awayTeamId: 't-a',
        homeGoals: 1,
        awayGoals: 1,
      },
    ]);

    expect(standings[0].teamName).toBe('Equipo A');
    expect(standings[0].points).toBe(4);
    expect(standings.find((s) => s.teamName === 'Equipo B')?.points).toBe(0);
    expect(standings.find((s) => s.teamName === 'Equipo B')?.descuentoPuntosWO).toBe(3);
  });

  it('aplica W.O. 3-0', () => {
    expect(applyWalkoverResult(true)).toEqual({ homeGoals: 3, awayGoals: 0 });
    expect(applyWalkoverResult(false)).toEqual({ homeGoals: 0, awayGoals: 3 });
  });

  it('detecta suspensiones por 5 amarillas (Art. 39)', () => {
    const counts = countYellowCardsByPerson([
      { personaId: 'p1', tipo: 'amarilla' },
      { personaId: 'p1', tipo: 'amarilla' },
      { personaId: 'p1', tipo: 'amarilla' },
      { personaId: 'p1', tipo: 'amarilla' },
      { personaId: 'p1', tipo: 'amarilla' },
      { personaId: 'p2', tipo: 'amarilla' },
    ]);
    expect(playersSuspendedByYellows(counts)).toEqual(['p1']);
  });
});
