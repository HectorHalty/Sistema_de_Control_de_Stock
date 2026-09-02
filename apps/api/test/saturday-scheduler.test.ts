import { describe, expect, it } from 'vitest';
import { scheduleSaturdayMatches } from '../src/football/saturday-scheduler';

describe('SaturdayScheduler', () => {
  const slots = [
    { canchaId: 'c1', canchaNumero: 1, horaInicio: '12:00' },
    { canchaId: 'c2', canchaNumero: 2, horaInicio: '12:00' },
    { canchaId: 'c1', canchaNumero: 1, horaInicio: '13:00' },
  ];

  it('programa partidos de distintas categorías sin doble uso de slot', () => {
    const result = scheduleSaturdayMatches({
      matches: [
        {
          id: 'm1',
          torneoId: 't1',
          homeInscripcionId: 'h1',
          awayInscripcionId: 'a1',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
          categoriaCodigo: 'mujeres_a',
          categoriaNombre: 'Mujeres A',
          grupoCodigo: 'mujeres',
          allowedCanchaIds: new Set(['c1', 'c2']),
          allowedHoras: new Set(['12:00', '13:00']),
        },
        {
          id: 'm2',
          torneoId: 't2',
          homeInscripcionId: 'h2',
          awayInscripcionId: 'a2',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
          categoriaCodigo: 'hombres_libre_a',
          categoriaNombre: 'Libre A',
          grupoCodigo: 'hombres_a',
          allowedCanchaIds: new Set(['c1', 'c2']),
          allowedHoras: new Set(['12:00', '13:00']),
        },
      ],
      slots,
      preferences: {},
      teamNames: {},
      categoriaOrder: ['mujeres_a', 'hombres_libre_a'],
      existingCanchaOccupied: new Set(),
      existingTeamOccupied: new Set(),
    });

    expect(result.assignments).toHaveLength(2);
    const keys = result.assignments.map((a) => `${a.canchaId}|${a.horaInicio}`);
    expect(new Set(keys).size).toBe(2);
  });
});
