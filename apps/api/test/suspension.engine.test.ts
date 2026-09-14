import { describe, expect, it } from 'vitest';
import {
  findYellowThresholdMatch,
  inferInitialFechas,
  remainingFechas,
  sanctionsFromMatchEvents,
  scoreFromGoalEvents,
} from '../src/football/suspension.engine';

describe('SuspensionEngine', () => {
  it('genera sanción de 2 fechas por roja directa', () => {
    const drafts = sanctionsFromMatchEvents('p1', [
      { personaId: 'a', tipo: 'roja' },
    ]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].motivo).toBe('Tarjeta roja directa');
    expect(drafts[0].fechasIniciales).toBe(2);
  });

  it('genera sanción por doble amarilla en el mismo partido', () => {
    const drafts = sanctionsFromMatchEvents('p1', [
      { personaId: 'a', tipo: 'amarilla' },
      { personaId: 'a', tipo: 'amarilla' },
    ]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].motivo).toBe('Doble amarilla');
    expect(drafts[0].fechasIniciales).toBe(1);
  });

  it('encuentra el partido del umbral de amarillas', () => {
    const events = [
      { partidoId: 'p1', personaId: 'x', tipo: 'amarilla', matchDate: new Date('2026-01-01') },
      { partidoId: 'p2', personaId: 'x', tipo: 'amarilla', matchDate: new Date('2026-01-08') },
      { partidoId: 'p3', personaId: 'x', tipo: 'amarilla', matchDate: new Date('2026-01-15') },
      { partidoId: 'p4', personaId: 'x', tipo: 'amarilla', matchDate: new Date('2026-01-22') },
      { partidoId: 'p5', personaId: 'x', tipo: 'amarilla', matchDate: new Date('2026-01-29') },
    ];
    expect(findYellowThresholdMatch('x', events, 5)).toBe('p5');
  });

  it('calcula fechas restantes tras partidos jugados', () => {
    expect(remainingFechas(2, 1)).toBe(1);
    expect(remainingFechas(1, 2)).toBe(0);
    expect(inferInitialFechas('Tarjeta roja directa')).toBe(2);
    expect(inferInitialFechas('Doble amarilla')).toBe(1);
  });

  it('cuenta goles por plantel local/visitante', () => {
    const home = new Set(['h1']);
    const away = new Set(['a1']);
    const score = scoreFromGoalEvents(
      [
        { personaId: 'h1', tipo: 'gol' },
        { personaId: 'h1', tipo: 'gol' },
        { personaId: 'a1', tipo: 'gol' },
      ],
      home,
      away,
    );
    expect(score).toEqual({ homeGoals: 2, awayGoals: 1 });
  });
});
