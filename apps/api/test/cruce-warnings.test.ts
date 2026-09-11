import { describe, expect, it } from 'vitest';
import { collectCruceWarnings, CRUCE_WARNINGS } from '../src/football/cruce-warnings';

const base = {
  matchId: 'm1',
  nuevaHomeInscripcionId: 'h',
  nuevaAwayInscripcionId: 'a',
  jornadaPublicada: false,
  matchTieneResultado: false,
  inscripcionIdsTorneo: ['h', 'a', 'x', 'y'],
  partidosJornada: [
    { id: 'm1', homeInscripcionId: 'h', awayInscripcionId: 'a' },
    { id: 'm2', homeInscripcionId: 'x', awayInscripcionId: 'y' },
  ],
  paresOtrasJornadas: [] as { homeTeamId: string; awayTeamId: string }[],
  nuevaHomeTeamId: 'th',
  nuevaAwayTeamId: 'ta',
};

describe('collectCruceWarnings', () => {
  it('avisa si un equipo queda dos veces en la fecha', () => {
    const warnings = collectCruceWarnings({
      ...base,
      nuevaAwayInscripcionId: 'x',
      nuevaAwayTeamId: 'tx',
    });
    expect(warnings).toContain(CRUCE_WARNINGS.dobleEnFecha);
    expect(warnings).toContain(CRUCE_WARNINGS.fechaIncoherente);
  });

  it('avisa cruce repetido en otra jornada', () => {
    const warnings = collectCruceWarnings({
      ...base,
      paresOtrasJornadas: [{ homeTeamId: 'ta', awayTeamId: 'th' }],
    });
    expect(warnings).toContain(CRUCE_WARNINGS.cruceRepetido);
  });

  it('avisa si hay resultado o jornada publicada', () => {
    expect(
      collectCruceWarnings({ ...base, matchTieneResultado: true }),
    ).toContain(CRUCE_WARNINGS.resultadoOPublicado);
    expect(
      collectCruceWarnings({ ...base, jornadaPublicada: true }),
    ).toContain(CRUCE_WARNINGS.resultadoOPublicado);
  });

  it('sin problemas no avisa', () => {
    expect(collectCruceWarnings(base)).toEqual([]);
  });
});
