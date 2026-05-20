import type { FootballMatch, FootballTeam, StandingRow } from './types';

export function buildStandings(teams: FootballTeam[], matches: FootballMatch[]): StandingRow[] {
  const standings = new Map<string, StandingRow>();

  teams.forEach(team => {
    standings.set(team.id, {
      teamId: team.id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  });

  matches
    .filter(match => match.status === 'jugado')
    .forEach(match => {
      const home = standings.get(match.homeTeamId);
      const away = standings.get(match.awayTeamId);
      if (!home || !away) return;

      const homeGoals = match.homeGoals ?? 0;
      const awayGoals = match.awayGoals ?? 0;

      home.played += 1;
      away.played += 1;
      home.goalsFor += homeGoals;
      home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals;
      away.goalsAgainst += homeGoals;

      if (homeGoals > awayGoals) {
        home.won += 1;
        home.points += 3;
        away.lost += 1;
      } else if (homeGoals < awayGoals) {
        away.won += 1;
        away.points += 3;
        home.lost += 1;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    });

  return Array.from(standings.values()).sort((a, b) => {
    const pointDiff = b.points - a.points;
    if (pointDiff !== 0) return pointDiff;

    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    const goalDiff = gdB - gdA;
    if (goalDiff !== 0) return goalDiff;

    return b.goalsFor - a.goalsFor;
  });
}

export function getUpcomingMatches(matches: FootballMatch[]): FootballMatch[] {
  return matches
    .filter(match => match.status === 'pendiente')
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
}
