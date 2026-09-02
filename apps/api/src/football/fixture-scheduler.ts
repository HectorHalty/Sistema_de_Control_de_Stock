export type SchedulerMatch = {
  id: string;
  homeInscripcionId: string | null;
  awayInscripcionId: string | null;
  bloqueadoManual: boolean;
  canchaId: string | null;
  horaInicio: string | null;
};

export type SchedulerSlot = {
  canchaId: string;
  canchaNumero: number;
  horaInicio: string;
};

export type SchedulerAssignment = {
  matchId: string;
  canchaId: string;
  horaInicio: string;
  venue: string;
};

export type SchedulerPreferences = Record<string, string>;

export type SchedulerResult = {
  assignments: SchedulerAssignment[];
  warnings: string[];
  skipped: string[];
};

function teamKey(inscripcionId: string | null, hora: string): string | null {
  if (!inscripcionId) return null;
  return `${inscripcionId}|${hora}`;
}

function slotKey(canchaId: string, hora: string): string {
  return `${canchaId}|${hora}`;
}

function preferredHoursForMatch(
  match: SchedulerMatch,
  preferences: SchedulerPreferences,
): Set<string> {
  const hours = new Set<string>();
  if (match.homeInscripcionId && preferences[match.homeInscripcionId]) {
    hours.add(preferences[match.homeInscripcionId]);
  }
  if (match.awayInscripcionId && preferences[match.awayInscripcionId]) {
    hours.add(preferences[match.awayInscripcionId]);
  }
  return hours;
}

function sortSlotsForMatch(
  slots: SchedulerSlot[],
  preferredHours: Set<string>,
): SchedulerSlot[] {
  if (!preferredHours.size) return slots;
  return [...slots].sort((a, b) => {
    const aScore = preferredHours.has(a.horaInicio) ? 0 : 1;
    const bScore = preferredHours.has(b.horaInicio) ? 0 : 1;
    if (aScore !== bScore) return aScore - bScore;
    return a.horaInicio.localeCompare(b.horaInicio) || a.canchaNumero - b.canchaNumero;
  });
}

function matchPreferenceScore(match: SchedulerMatch, preferences: SchedulerPreferences): number {
  let score = 0;
  if (match.homeInscripcionId && preferences[match.homeInscripcionId]) score++;
  if (match.awayInscripcionId && preferences[match.awayInscripcionId]) score++;
  return score;
}

/** Auto-asigna cancha/hora respetando slots ocupados, equipos sin doble horario y preferencias. */
export function autoScheduleMatches(
  matches: SchedulerMatch[],
  slots: SchedulerSlot[],
  existingCanchaOccupied: Set<string>,
  existingTeamOccupied: Set<string>,
  preferences: SchedulerPreferences = {},
  teamNames: Record<string, string> = {},
): SchedulerResult {
  const assignments: SchedulerAssignment[] = [];
  const warnings: string[] = [];
  const skipped: string[] = [];

  const canchaOccupied = new Set(existingCanchaOccupied);
  const teamOccupied = new Set(existingTeamOccupied);

  const pending = matches.filter((m) => {
    if (m.bloqueadoManual && m.canchaId && m.horaInicio) {
      skipped.push(m.id);
      canchaOccupied.add(slotKey(m.canchaId, m.horaInicio));
      for (const tk of [
        teamKey(m.homeInscripcionId, m.horaInicio),
        teamKey(m.awayInscripcionId, m.horaInicio),
      ]) {
        if (tk) teamOccupied.add(tk);
      }
      return false;
    }
    return true;
  });

  pending.sort(
    (a, b) => matchPreferenceScore(b, preferences) - matchPreferenceScore(a, preferences),
  );

  for (const match of pending) {
    let assigned = false;
    const preferredHours = preferredHoursForMatch(match, preferences);
    const orderedSlots = sortSlotsForMatch(slots, preferredHours);

    for (const slot of orderedSlots) {
      const sk = slotKey(slot.canchaId, slot.horaInicio);
      if (canchaOccupied.has(sk)) continue;

      const homeTk = teamKey(match.homeInscripcionId, slot.horaInicio);
      const awayTk = teamKey(match.awayInscripcionId, slot.horaInicio);
      if (homeTk && teamOccupied.has(homeTk)) continue;
      if (awayTk && teamOccupied.has(awayTk)) continue;

      canchaOccupied.add(sk);
      if (homeTk) teamOccupied.add(homeTk);
      if (awayTk) teamOccupied.add(awayTk);

      assignments.push({
        matchId: match.id,
        canchaId: slot.canchaId,
        horaInicio: slot.horaInicio,
        venue: `Cancha ${slot.canchaNumero}`,
      });
      assigned = true;

      if (preferredHours.size && !preferredHours.has(slot.horaInicio)) {
        const teams: string[] = [];
        if (
          match.homeInscripcionId &&
          preferences[match.homeInscripcionId] &&
          preferences[match.homeInscripcionId] !== slot.horaInicio
        ) {
          teams.push(
            `${teamNames[match.homeInscripcionId] ?? 'Local'} (pref. ${preferences[match.homeInscripcionId]})`,
          );
        }
        if (
          match.awayInscripcionId &&
          preferences[match.awayInscripcionId] &&
          preferences[match.awayInscripcionId] !== slot.horaInicio
        ) {
          teams.push(
            `${teamNames[match.awayInscripcionId] ?? 'Visitante'} (pref. ${preferences[match.awayInscripcionId]})`,
          );
        }
        if (teams.length) {
          warnings.push(
            `Partido ${match.id}: preferencia no cumplida para ${teams.join(' / ')} — asignado ${slot.horaInicio}`,
          );
        }
      }
      break;
    }

    if (!assigned) {
      warnings.push(`Sin slot disponible para partido ${match.id}`);
    }
  }

  return { assignments, warnings, skipped };
}
