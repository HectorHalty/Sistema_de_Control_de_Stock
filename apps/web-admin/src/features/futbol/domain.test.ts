import { describe, expect, it } from 'vitest';
import type { FootballMatch, FootballTeam } from './types';
import { buildStandings, getUpcomingMatches } from './domain';

const teams: FootballTeam[] = [
  { id: 't1', name: 'Chacra A', category: 'Primera' },
  { id: 't2', name: 'Potrero', category: 'Primera' },
];

const matches: FootballMatch[] = [
  {
    id: 'm1',
    round: 1,
    homeTeamId: 't1',
    awayTeamId: 't2',
    dateISO: '2026-01-10T20:00:00.000Z',
    status: 'jugado',
    homeGoals: 2,
    awayGoals: 0,
  },
  {
    id: 'm2',
    round: 2,
    homeTeamId: 't2',
    awayTeamId: 't1',
    dateISO: '2026-02-15T20:00:00.000Z',
    status: 'pendiente',
  },
  {
    id: 'm3',
    round: 3,
    homeTeamId: 't1',
    awayTeamId: 't2',
    dateISO: '2026-01-20T20:00:00.000Z',
    status: 'pendiente',
  },
];

describe('futbol/domain', () => {
  it('calcula tabla con puntos correctos', () => {
    const standings = buildStandings(teams, matches);
    const chacraA = standings.find(row => row.teamId === 't1');
    const potrero = standings.find(row => row.teamId === 't2');

    expect(chacraA?.points).toBe(3);
    expect(chacraA?.won).toBe(1);
    expect(potrero?.points).toBe(0);
    expect(potrero?.lost).toBe(1);
  });

  it('ordena próximos encuentros por fecha', () => {
    const upcoming = getUpcomingMatches(matches);
    expect(upcoming.length).toBe(2);
    expect(new Date(upcoming[0].dateISO).getTime()).toBeLessThanOrEqual(
      new Date(upcoming[1].dateISO).getTime(),
    );
  });
});
