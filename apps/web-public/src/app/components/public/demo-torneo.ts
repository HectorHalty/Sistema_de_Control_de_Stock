/** Datos ficticios de torneo — placeholder hasta el generador real de fixture. */

export const DEMO_STANDINGS = [
  { pos: 1, team: 'Los Pibes FC', abbr: 'LPF', pj: 8, pg: 6, pe: 1, pp: 1, gf: 18, gc: 7, pts: 19 },
  { pos: 2, team: 'La Escaloneta', abbr: 'ESC', pj: 8, pg: 5, pe: 2, pp: 1, gf: 15, gc: 9, pts: 17 },
  { pos: 3, team: 'Real Albañil', abbr: 'RAL', pj: 8, pg: 4, pe: 2, pp: 2, gf: 12, gc: 10, pts: 14 },
  { pos: 4, team: 'El Rejunte', abbr: 'REJ', pj: 8, pg: 3, pe: 3, pp: 2, gf: 11, gc: 11, pts: 12 },
];

export const DEMO_RECENT_RESULTS = [
  {
    id: 'r1',
    local: 'Los Pibes FC',
    visitante: 'Real Albañil',
    homeGoals: 3,
    awayGoals: 1,
    date: 'Sáb 15 Nov',
    cancha: 'Cancha B',
  },
  {
    id: 'r2',
    local: 'La Escaloneta',
    visitante: 'Los Pibes FC',
    homeGoals: 1,
    awayGoals: 2,
    date: 'Sáb 8 Nov',
    cancha: 'Cancha A',
  },
  {
    id: 'r3',
    local: 'El Rejunte',
    visitante: 'Real Dynamo',
    homeGoals: 2,
    awayGoals: 2,
    date: 'Sáb 1 Nov',
    cancha: 'Cancha A',
  },
];

export const DEMO_NEXT_MATCH = {
  local: 'Los Pibes FC',
  visitante: 'Real Dynamo',
  fecha: 'Sáb 22 Nov',
  hora: '14:00',
  cancha: 'Cancha 1',
  jornada: 5,
};

export const DEMO_TOP_SCORERS = [
  { rank: 1, player: 'Alex Machina', team: 'Los Pibes FC', goals: 8 },
  { rank: 2, player: 'C. Ramírez', team: 'El Rejunte', goals: 7 },
  { rank: 3, player: 'G. Domínguez', team: 'Superliga A', goals: 6 },
];
