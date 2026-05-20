import type { FootballMatch, FootballTeam } from './types';

export const footballTeams: FootballTeam[] = [
  { id: 't1', name: 'La Chacra A', category: 'Hombres A' },
  { id: 't2', name: 'Los del Potrero', category: 'Hombres A' },
  { id: 't3', name: 'Los Pibes FC', category: 'Hombres B' },
  { id: 't4', name: 'Barrio Norte', category: 'Hombres B' },
  { id: 't5', name: 'Las Guerreras', category: 'Mujeres A' },
  { id: 't6', name: 'Las Leonas', category: 'Mujeres A' },
];

export const footballMatches: FootballMatch[] = [
  { id: 'm1', round: 1, homeTeamId: 't1', awayTeamId: 't2', dateISO: '2026-05-10T10:00:00.000Z', status: 'jugado', homeGoals: 2, awayGoals: 1, field: 'Cancha 1', published: true },
  { id: 'm2', round: 1, homeTeamId: 't3', awayTeamId: 't4', dateISO: '2026-05-10T12:00:00.000Z', status: 'jugado', homeGoals: 0, awayGoals: 0, field: 'Cancha 2', published: true },
  { id: 'm3', round: 2, homeTeamId: 't1', awayTeamId: 't3', dateISO: '2026-05-17T10:30:00.000Z', status: 'pendiente', field: 'Cancha 1', published: false },
  { id: 'm4', round: 2, homeTeamId: 't2', awayTeamId: 't4', dateISO: '2026-05-17T12:30:00.000Z', status: 'pendiente', field: 'Cancha 2', published: false },
  { id: 'm5', round: 1, homeTeamId: 't5', awayTeamId: 't6', dateISO: '2026-05-12T18:00:00.000Z', status: 'jugado', homeGoals: 3, awayGoals: 2, field: 'Cancha 5', published: true },
];
