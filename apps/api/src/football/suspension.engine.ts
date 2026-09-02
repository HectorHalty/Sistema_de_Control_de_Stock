export type SanctionDraft = {
  personaId: string;
  motivo: string;
  fechasIniciales: number;
  origenPartidoId: string;
};

const RED_TYPES = new Set(['roja', 'expulsion_directa']);

export function inferInitialFechas(motivo: string): number {
  if (/roja|expulsión|expulsion/i.test(motivo)) return 2;
  return 1;
}

export function remainingFechas(fechasIniciales: number, playedTeamMatchesAfterSanction: number): number {
  return Math.max(0, fechasIniciales - playedTeamMatchesAfterSanction);
}

/** Sanciones por partido: rojas, doble amarilla explícita o 2+ amarillas en el mismo cruce. */
export function sanctionsFromMatchEvents(
  partidoId: string,
  events: Array<{ personaId: string; tipo: string }>,
): SanctionDraft[] {
  const drafts: SanctionDraft[] = [];
  const seen = new Set<string>();

  for (const ev of events) {
    if (!RED_TYPES.has(ev.tipo)) continue;
    const key = `${ev.personaId}:red`;
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({
      personaId: ev.personaId,
      motivo: ev.tipo === 'expulsion_directa' ? 'Expulsión directa' : 'Tarjeta roja directa',
      fechasIniciales: 2,
      origenPartidoId: partidoId,
    });
  }

  for (const ev of events) {
    if (ev.tipo !== 'doble_amarilla') continue;
    const key = `${ev.personaId}:doble`;
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({
      personaId: ev.personaId,
      motivo: 'Doble amarilla',
      fechasIniciales: 1,
      origenPartidoId: partidoId,
    });
  }

  const yellowsByPerson = new Map<string, number>();
  for (const ev of events) {
    if (ev.tipo !== 'amarilla') continue;
    yellowsByPerson.set(ev.personaId, (yellowsByPerson.get(ev.personaId) ?? 0) + 1);
  }

  for (const [personaId, count] of yellowsByPerson) {
    if (count < 2) continue;
    const key = `${personaId}:doble`;
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({
      personaId,
      motivo: 'Doble amarilla',
      fechasIniciales: 1,
      origenPartidoId: partidoId,
    });
  }

  return drafts;
}

/** Encuentra el partido donde el jugador acumula el umbral de amarillas (Art. 39). */
export function findYellowThresholdMatch(
  personaId: string,
  events: Array<{ partidoId: string; personaId: string; tipo: string; matchDate: Date }>,
  threshold = 5,
): string | null {
  const sorted = [...events]
    .filter(
      (e) =>
        e.personaId === personaId && (e.tipo === 'amarilla' || e.tipo === 'doble_amarilla'),
    )
    .sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime());

  let count = 0;
  for (const ev of sorted) {
    count += ev.tipo === 'doble_amarilla' ? 2 : 1;
    if (count >= threshold) return ev.partidoId;
  }
  return null;
}

export function scoreFromGoalEvents(
  events: Array<{ personaId: string; tipo: string }>,
  homePersonaIds: Set<string>,
  awayPersonaIds: Set<string>,
): { homeGoals: number; awayGoals: number } {
  let homeGoals = 0;
  let awayGoals = 0;

  for (const ev of events) {
    if (ev.tipo !== 'gol') continue;
    if (homePersonaIds.has(ev.personaId)) homeGoals++;
    else if (awayPersonaIds.has(ev.personaId)) awayGoals++;
  }

  return { homeGoals, awayGoals };
}
