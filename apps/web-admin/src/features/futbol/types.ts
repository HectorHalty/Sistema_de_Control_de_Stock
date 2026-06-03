export interface FootballTeam {
  id: string;
  name: string;
  category: string;
}

export interface FootballMatch {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  dateISO: string;
  status: 'pendiente' | 'jugado';
  homeGoals?: number;
  awayGoals?: number;
  field?: string;
  published?: boolean;
  suspended?: boolean;
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}
