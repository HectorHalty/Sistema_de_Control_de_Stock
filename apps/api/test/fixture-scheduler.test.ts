import { describe, expect, it } from 'vitest';
import { autoScheduleMatches, type SchedulerSlot } from '../src/football/fixture-scheduler';

describe('FixtureScheduler', () => {
  const slots: SchedulerSlot[] = [
    { canchaId: 'c1', canchaNumero: 1, horaInicio: '12:00' },
    { canchaId: 'c2', canchaNumero: 2, horaInicio: '12:00' },
    { canchaId: 'c1', canchaNumero: 1, horaInicio: '13:00' },
  ];

  it('asigna partidos a slots libres', () => {
    const result = autoScheduleMatches(
      [
        {
          id: 'm1',
          homeInscripcionId: 'h1',
          awayInscripcionId: 'a1',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
        },
        {
          id: 'm2',
          homeInscripcionId: 'h2',
          awayInscripcionId: 'a2',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
        },
      ],
      slots,
      new Set(),
      new Set(),
    );

    expect(result.assignments).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
  });

  it('no asigna dos partidos al mismo slot de cancha', () => {
    const result = autoScheduleMatches(
      [
        {
          id: 'm1',
          homeInscripcionId: 'h1',
          awayInscripcionId: 'a1',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
        },
        {
          id: 'm2',
          homeInscripcionId: 'h2',
          awayInscripcionId: 'a2',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
        },
        {
          id: 'm3',
          homeInscripcionId: 'h3',
          awayInscripcionId: 'a3',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
        },
        {
          id: 'm4',
          homeInscripcionId: 'h4',
          awayInscripcionId: 'a4',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
        },
      ],
      slots,
      new Set(),
      new Set(),
    );

    const keys = result.assignments.map((a) => `${a.canchaId}|${a.horaInicio}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(result.warnings).toHaveLength(1);
  });

  it('respeta bloqueos manuales existentes', () => {
    const result = autoScheduleMatches(
      [
        {
          id: 'm1',
          homeInscripcionId: 'h1',
          awayInscripcionId: 'a1',
          bloqueadoManual: true,
          canchaId: 'c1',
          horaInicio: '12:00',
        },
        {
          id: 'm2',
          homeInscripcionId: 'h2',
          awayInscripcionId: 'a2',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
        },
      ],
      slots,
      new Set(),
      new Set(),
    );

    expect(result.skipped).toEqual(['m1']);
    expect(result.assignments[0]?.canchaId).toBe('c2');
  });

  it('evita que un equipo juegue dos partidos a la misma hora', () => {
    const result = autoScheduleMatches(
      [
        {
          id: 'm1',
          homeInscripcionId: 'h1',
          awayInscripcionId: 'a1',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
        },
        {
          id: 'm2',
          homeInscripcionId: 'h1',
          awayInscripcionId: 'a2',
          bloqueadoManual: false,
          canchaId: null,
          horaInicio: null,
        },
      ],
      slots,
      new Set(),
      new Set(),
    );

    const hours = result.assignments.map((a) => a.horaInicio);
    expect(new Set(hours).size).toBe(2);
  });
});
