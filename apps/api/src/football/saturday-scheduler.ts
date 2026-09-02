import {
  autoScheduleMatches,
  type SchedulerMatch,
  type SchedulerPreferences,
  type SchedulerSlot,
} from './fixture-scheduler';

export type SaturdayMatchInput = SchedulerMatch & {
  torneoId: string;
  categoriaCodigo: string;
  categoriaNombre: string;
  categoriaColor?: string | null;
  grupoCodigo: string;
  allowedCanchaIds: Set<string>;
  allowedHoras: Set<string>;
};

export type SaturdaySchedulerInput = {
  matches: SaturdayMatchInput[];
  slots: SchedulerSlot[];
  preferences: SchedulerPreferences;
  teamNames: Record<string, string>;
  categoriaOrder: string[];
  existingCanchaOccupied: Set<string>;
  existingTeamOccupied: Set<string>;
};

export type SaturdaySchedulerResult = {
  assignments: Array<{
    matchId: string;
    canchaId: string;
    horaInicio: string;
    venue: string;
    categoriaCodigo: string;
  }>;
  warnings: string[];
  skipped: string[];
  unassigned: string[];
};

function sortMatchesByCategory(
  matches: SaturdayMatchInput[],
  categoriaOrder: string[],
): SaturdayMatchInput[] {
  const rank = new Map(categoriaOrder.map((c, i) => [c, i]));
  return [...matches].sort((a, b) => {
    const ra = rank.get(a.categoriaCodigo) ?? 999;
    const rb = rank.get(b.categoriaCodigo) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.categoriaNombre.localeCompare(b.categoriaNombre, 'es');
  });
}

/** Programa partidos de todas las categorías compartiendo matriz global cancha×hora. */
export function scheduleSaturdayMatches(input: SaturdaySchedulerInput): SaturdaySchedulerResult {
  const {
    matches,
    slots,
    preferences,
    teamNames,
    categoriaOrder,
    existingCanchaOccupied,
    existingTeamOccupied,
  } = input;

  const assignments: SaturdaySchedulerResult['assignments'] = [];
  const warnings: string[] = [];
  const skipped: string[] = [];
  const unassigned: string[] = [];

  const canchaOccupied = new Set(existingCanchaOccupied);
  const teamOccupied = new Set(existingTeamOccupied);

  const pending = sortMatchesByCategory(
    matches.filter((m) => {
      if (m.bloqueadoManual && m.canchaId && m.horaInicio) {
        skipped.push(m.id);
        canchaOccupied.add(`${m.canchaId}|${m.horaInicio}`);
        if (m.homeInscripcionId) teamOccupied.add(`${m.homeInscripcionId}|${m.horaInicio}`);
        if (m.awayInscripcionId) teamOccupied.add(`${m.awayInscripcionId}|${m.horaInicio}`);
        return false;
      }
      return true;
    }),
    categoriaOrder,
  );

  for (const match of pending) {
    const validSlots = slots.filter(
      (s) => match.allowedCanchaIds.has(s.canchaId) && match.allowedHoras.has(s.horaInicio),
    );

    if (!validSlots.length) {
      unassigned.push(match.id);
      warnings.push(
        `${match.categoriaNombre}: sin franjas/canchas válidas para partido ${match.id}`,
      );
      continue;
    }

    const result = autoScheduleMatches(
      [match],
      validSlots,
      canchaOccupied,
      teamOccupied,
      preferences,
      teamNames,
    );

    if (result.assignments.length) {
      const a = result.assignments[0]!;
      assignments.push({ ...a, categoriaCodigo: match.categoriaCodigo });
      canchaOccupied.add(`${a.canchaId}|${a.horaInicio}`);
      if (match.homeInscripcionId) teamOccupied.add(`${match.homeInscripcionId}|${a.horaInicio}`);
      if (match.awayInscripcionId) teamOccupied.add(`${match.awayInscripcionId}|${a.horaInicio}`);
    } else {
      unassigned.push(match.id);
    }

    warnings.push(...result.warnings);
  }

  return { assignments, warnings, skipped, unassigned };
}
