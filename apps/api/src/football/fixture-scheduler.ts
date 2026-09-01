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

/** Auto-asigna cancha/hora respetando slots ocupados y equipos sin doble horario. */
export function autoScheduleMatches(
  matches: SchedulerMatch[],
  slots: SchedulerSlot[],
  existingCanchaOccupied: Set<string>,
  existingTeamOccupied: Set<string>,
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

  for (const match of pending) {
    let assigned = false;

    for (const slot of slots) {
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
      break;
    }

    if (!assigned) {
      warnings.push(`Sin slot disponible para partido ${match.id}`);
    }
  }

  return { assignments, warnings, skipped };
}
