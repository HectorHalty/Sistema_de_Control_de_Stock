/**
 * Datos ficticios de torneo — placeholder hasta el generador real de fixture.
 *
 * Los nombres y números están alineados con el fixture del adapter de identidad
 * (`src/app/mocks/futbol-identity.ts`): Home y `/torneo` están a un click de
 * distancia y no deben mostrar dos torneos inventados distintos.
 */

export const DEMO_STANDINGS = [
  { inscripcionId: 'ei-depredadores', pos: 1, team: 'Depredadores FC', abbr: 'DEP', pj: 8, pg: 6, pe: 1, pp: 1, gf: 19, gc: 8, pts: 19 },
  { inscripcionId: 'ei-truenos', pos: 2, team: 'Truenos del Sur', abbr: 'TRU', pj: 8, pg: 5, pe: 2, pp: 1, gf: 16, gc: 9, pts: 17 },
  { inscripcionId: 'ei-halcones', pos: 3, team: 'Los Halcones', abbr: 'HAL', pj: 8, pg: 4, pe: 2, pp: 2, gf: 14, gc: 11, pts: 14 },
  { inscripcionId: 'ei-tromba', pos: 4, team: 'La Tromba', abbr: 'TRB', pj: 8, pg: 3, pe: 2, pp: 3, gf: 12, gc: 13, pts: 11 },
];

export const DEMO_RECENT_RESULTS = [
  {
    id: 'r1',
    local: 'Los Halcones',
    visitante: 'Real Potrero',
    homeGoals: 3,
    awayGoals: 1,
    date: 'Sáb 15 Nov',
    cancha: 'Cancha 1',
  },
  {
    id: 'r2',
    local: 'Depredadores FC',
    visitante: 'Los Halcones',
    homeGoals: 2,
    awayGoals: 2,
    date: 'Sáb 8 Nov',
    cancha: 'Cancha 2',
  },
  {
    id: 'r3',
    local: 'La Tromba',
    visitante: 'Truenos del Sur',
    homeGoals: 0,
    awayGoals: 1,
    date: 'Sáb 1 Nov',
    cancha: 'Cancha 1',
  },
];

export const DEMO_NEXT_MATCH = {
  local: 'Los Halcones',
  visitante: 'Depredadores FC',
  fecha: 'Sáb 22 Nov',
  hora: '14:00',
  cancha: 'Cancha 1',
  jornada: 9,
};

export const DEMO_TOP_SCORERS = [
  { rank: 1, player: 'J. Pérez', team: 'Los Halcones', goals: 8 },
  { rank: 2, player: 'M. Ferreyra', team: 'Depredadores FC', goals: 7 },
  { rank: 3, player: 'G. Domínguez', team: 'Truenos del Sur', goals: 6 },
];
