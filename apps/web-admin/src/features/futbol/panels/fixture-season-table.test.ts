import { describe, expect, it, vi } from 'vitest';
import {
  buildSeasonTable,
  invertCruce,
  isFixtureRegenerable,
  pickSelectedJornada,
} from './fixture-season-table';
import type { FootballJornada, FootballMatch, FootballInscription } from '@/app/api/client';

const j1 = { id: 'j1', torneoId: 't', numero: 1, fecha: '2026-08-22', suspendida: false, esRecuperacion: false, publicada: false, equipoLibreId: 'i3' } satisfies FootballJornada;
const j2 = { ...j1, id: 'j2', numero: 2, equipoLibreId: null, publicada: false };

const inscripciones = [
  { id: 'i1', torneoId: 't', equipoId: 'e1', equipo: { id: 'e1', name: 'Alfa' } },
  { id: 'i2', torneoId: 't', equipoId: 'e2', equipo: { id: 'e2', name: 'Beta' } },
  { id: 'i3', torneoId: 't', equipoId: 'e3', equipo: { id: 'e3', name: 'Gamma' } },
] as FootballInscription[];

const matches = [
  { id: 'm1', homeTeamId: 'e1', awayTeamId: 'e2', date: '', status: 'pendiente', jornadaId: 'j1', homeTeam: { id: 'e1', name: 'Alfa' }, awayTeam: { id: 'e2', name: 'Beta' } },
  { id: 'm2', homeTeamId: 'e1', awayTeamId: 'e3', date: '', status: 'pendiente', jornadaId: 'j2', homeTeam: { id: 'e1', name: 'Alfa' }, awayTeam: { id: 'e3', name: 'Gamma' } },
] as FootballMatch[];

describe('buildSeasonTable', () => {
  it('arma filas por jornada con nombres, no números', () => {
    const rows = buildSeasonTable([j2, j1], matches, inscripciones);
    expect(rows.map((r) => r.jornada.numero)).toEqual([1, 2]);
    expect(rows[0].libreNombre).toBe('Gamma');
    expect(rows[0].partidos[0].homeTeam?.name).toBe('Alfa');
    expect(rows[0].partidos[0].awayTeam?.name).toBe('Beta');
  });
});

describe('isFixtureRegenerable', () => {
  it('true solo con jornadas, ninguna publicada y sin resultados', () => {
    expect(isFixtureRegenerable([j1], matches)).toBe(true);
    expect(isFixtureRegenerable([], matches)).toBe(false);
    expect(isFixtureRegenerable([{ ...j1, publicada: true }], matches)).toBe(false);
    expect(isFixtureRegenerable([j1], [{ ...matches[0], status: 'jugado' }])).toBe(false);
  });
});

describe('pickSelectedJornada', () => {
  it('reselecciona la primera jornada cuando la actual ya no existe', () => {
    expect(pickSelectedJornada('eliminada', [j2, j1])).toBe('j2');
    expect(pickSelectedJornada('j1', [j2, j1])).toBe('j1');
    expect(pickSelectedJornada('eliminada', [])).toBe('');
  });
});

describe('invertCruce', () => {
  it('envía local y visitante invertidos en una sola llamada', () => {
    const onCruceChange = vi.fn();

    invertCruce('m1', 'i1', 'i2', onCruceChange);

    expect(onCruceChange).toHaveBeenCalledOnce();
    expect(onCruceChange).toHaveBeenCalledWith('m1', 'i2', 'i1');
  });
});
