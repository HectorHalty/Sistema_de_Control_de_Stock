import { describe, it, expect } from 'vitest';
import { buildTorneoPublico } from './futbol-identity-real';
import type { PublicTorneoDetail } from '../../../api/public-api';

function detail(over: Partial<PublicTorneoDetail> = {}): PublicTorneoDetail {
  return {
    torneo: { id: 't1', nombre: 'Torneo Apertura', categoria: 'Libre A', campeonato: 'Apertura 2026', temporada: '2026' },
    standings: [
      {
        inscripcionId: 'ei-1', teamId: 'ei-1', teamName: 'Los Halcones',
        played: 8, won: 6, drawn: 1, lost: 1, goalsFor: 19, goalsAgainst: 8, goalDiff: 11, points: 19,
      },
    ],
    equipos: [
      { id: 'ei-1', name: 'Los Halcones', shortName: 'HAL', color: '#6BFF9E' },
      { id: 'ei-2', name: 'Depredadores FC', shortName: 'DEP', color: '#f87171' },
    ],
    partidos: [
      {
        id: 'm1', fecha: '2026-09-20T14:00:00.000Z', hora: '14:00', cancha: 'Cancha 1', jornada: 9,
        status: 'pendiente', homeGoals: null, awayGoals: null, local: 'Los Halcones', visitante: 'Depredadores FC',
      },
      {
        id: 'm2', fecha: '2026-09-06T14:00:00.000Z', hora: '14:00', cancha: 'Cancha 1', jornada: 8,
        status: 'jugado', homeGoals: 3, awayGoals: 1, local: 'Los Halcones', visitante: 'Real Potrero',
      },
    ],
    goleadores: [],
    suspensiones: [],
    tarjetas: [],
    ...over,
  };
}

describe('buildTorneoPublico', () => {
  it('separa partidos pendientes de jugados', () => {
    const result = buildTorneoPublico(detail());
    expect(result.proximosPartidos).toHaveLength(1);
    expect(result.proximosPartidos[0].id).toBe('m1');
    expect(result.resultados).toHaveLength(1);
    expect(result.resultados[0]).toEqual({
      id: 'm2', local: 'Los Halcones', visitante: 'Real Potrero',
      golesLocal: 3, golesVisitante: 1, fecha: '2026-09-06T14:00:00.000Z',
    });
  });

  it('resuelve el id de equipo en los próximos partidos buscando por nombre', () => {
    const result = buildTorneoPublico(detail());
    expect(result.proximosPartidos[0].local).toEqual({ id: 'ei-1', name: 'Los Halcones', shortName: 'HAL' });
    expect(result.proximosPartidos[0].visitante).toEqual({ id: 'ei-2', name: 'Depredadores FC', shortName: 'DEP' });
  });

  it('un equipo sin match en `equipos` no rompe: id vacío', () => {
    const result = buildTorneoPublico(detail({
      partidos: [
        { id: 'm3', fecha: '2026-09-27T14:00:00.000Z', hora: null, cancha: null, jornada: 10, status: 'pendiente', homeGoals: null, awayGoals: null, local: 'Equipo Fantasma', visitante: 'Los Halcones' },
      ],
    }));
    expect(result.proximosPartidos[0].local).toEqual({ id: '', name: 'Equipo Fantasma', shortName: undefined });
  });

  it('pasa standings sin transformar', () => {
    const d = detail();
    const result = buildTorneoPublico(d);
    expect(result.standings).toBe(d.standings);
  });

  it('sin torneo (null) devuelve torneo con valores vacíos', () => {
    const result = buildTorneoPublico({
      ...detail(),
      torneo: { id: '', nombre: '', categoria: '', campeonato: '', temporada: '' },
    });
    expect(result.torneo.id).toBe('');
  });
});
