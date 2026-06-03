import { describe, expect, it } from 'vitest';
import { footballMatches, footballTeams } from './data';
import { buildStandings, getUpcomingMatches } from './domain';

describe('futbol/domain', () => {
  it('calcula tabla con puntos correctos', () => {
    const standings = buildStandings(footballTeams, footballMatches);
    const chacraA = standings.find(row => row.teamId === 't1');
    const potrero = standings.find(row => row.teamId === 't2');

    expect(chacraA?.points).toBe(3);
    expect(chacraA?.won).toBe(1);
    expect(potrero?.points).toBe(0);
    expect(potrero?.lost).toBe(1);
  });

  it('ordena próximos encuentros por fecha', () => {
    const upcoming = getUpcomingMatches(footballMatches);
    expect(upcoming.length).toBeGreaterThan(0);
    expect(new Date(upcoming[0].dateISO).getTime()).toBeLessThanOrEqual(new Date(upcoming[1].dateISO).getTime());
  });
});
