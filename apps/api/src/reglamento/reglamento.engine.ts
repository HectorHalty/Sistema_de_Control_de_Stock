export type StandingRow = {
  inscripcionId: string;
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  descuentoPuntosWO: number;
};

export type MatchForStandings = {
  status: string;
  homeInscripcionId: string | null;
  awayInscripcionId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  esWO?: boolean;
};

export type TorneoRules = {
  puntosVictoria: number;
  puntosEmpate: number;
  puntosDerrota: number;
  criteriosDesempate: string[];
};

export type InscripcionMeta = {
  id: string;
  teamId: string;
  teamName: string;
  descuentoPuntosWO: number;
};

const DEFAULT_RULES: TorneoRules = {
  puntosVictoria: 3,
  puntosEmpate: 1,
  puntosDerrota: 0,
  criteriosDesempate: [
    'difGoles',
    'golesContra',
    'enfrentamientoDirecto',
    'fairPlay',
    'expulsados',
    'sorteo',
  ],
};

export function computeStandings(
  inscripciones: InscripcionMeta[],
  matches: MatchForStandings[],
  rules: Partial<TorneoRules> = {},
): StandingRow[] {
  const cfg = { ...DEFAULT_RULES, ...rules };
  const table = new Map<string, StandingRow>();

  for (const ins of inscripciones) {
    table.set(ins.id, {
      inscripcionId: ins.id,
      teamId: ins.teamId,
      teamName: ins.teamName,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      descuentoPuntosWO: ins.descuentoPuntosWO ?? 0,
    });
  }

  const played = matches.filter((m) => m.status === 'jugado' || m.status === 'wo' || m.esWO);

  for (const m of played) {
    const homeKey = m.homeInscripcionId;
    const awayKey = m.awayInscripcionId;
    if (!homeKey || !awayKey) continue;

    const home = table.get(homeKey);
    const away = table.get(awayKey);
    if (!home || !away) continue;

    const hg = m.homeGoals ?? 0;
    const ag = m.awayGoals ?? 0;

    home.played++;
    away.played++;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;

    if (hg > ag) {
      home.won++;
      away.lost++;
      home.points += cfg.puntosVictoria;
      away.points += cfg.puntosDerrota;
    } else if (hg < ag) {
      away.won++;
      home.lost++;
      away.points += cfg.puntosVictoria;
      home.points += cfg.puntosDerrota;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += cfg.puntosEmpate;
      away.points += cfg.puntosEmpate;
    }
  }

  const rows = Array.from(table.values()).map((r) => ({
    ...r,
    goalDiff: r.goalsFor - r.goalsAgainst,
    points: Math.max(0, r.points - r.descuentoPuntosWO),
  }));

  return sortStandings(rows, cfg.criteriosDesempate, played);
}

function sortStandings(
  rows: StandingRow[],
  criterios: string[],
  matches: MatchForStandings[],
): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;

    for (const criterio of criterios) {
      const cmp = compareByCriterion(a, b, criterio, matches);
      if (cmp !== 0) return cmp;
    }

    return a.teamName.localeCompare(b.teamName, 'es');
  });
}

function compareByCriterion(
  a: StandingRow,
  b: StandingRow,
  criterio: string,
  matches: MatchForStandings[],
): number {
  switch (criterio) {
    case 'difGoles':
      return b.goalDiff - a.goalDiff;
    case 'golesContra':
      return a.goalsAgainst - b.goalsAgainst;
    case 'golesFavor':
      return b.goalsFor - a.goalsFor;
    case 'enfrentamientoDirecto':
      return compareHeadToHead(a.inscripcionId, b.inscripcionId, matches);
    case 'fairPlay':
    case 'expulsados':
    case 'sorteo':
      return 0;
    default:
      return 0;
  }
}

function compareHeadToHead(
  aId: string,
  bId: string,
  matches: MatchForStandings[],
): number {
  let aPoints = 0;
  let bPoints = 0;

  for (const m of matches) {
    const isAb =
      (m.homeInscripcionId === aId && m.awayInscripcionId === bId) ||
      (m.homeInscripcionId === bId && m.awayInscripcionId === aId);
    if (!isAb) continue;

    const hg = m.homeGoals ?? 0;
    const ag = m.awayGoals ?? 0;
    if (hg === ag) {
      aPoints += 1;
      bPoints += 1;
    } else if (
      (m.homeInscripcionId === aId && hg > ag) ||
      (m.awayInscripcionId === aId && ag > hg)
    ) {
      aPoints += 3;
    } else {
      bPoints += 3;
    }
  }

  return bPoints - aPoints;
}

/** Art. 27–28: resultado W.O. 3-0 y descuento de puntos al cierre del torneo. */
export function applyWalkoverResult(
  ganadorEsLocal: boolean,
): { homeGoals: number; awayGoals: number } {
  return ganadorEsLocal ? { homeGoals: 3, awayGoals: 0 } : { homeGoals: 0, awayGoals: 3 };
}

/** Art. 39: acumula amarillas por persona en el torneo (desde eventos). */
export function countYellowCardsByPerson(
  events: Array<{ personaId: string; tipo: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ev of events) {
    if (ev.tipo !== 'amarilla' && ev.tipo !== 'doble_amarilla') continue;
    counts.set(ev.personaId, (counts.get(ev.personaId) ?? 0) + (ev.tipo === 'doble_amarilla' ? 2 : 1));
  }
  return counts;
}

/** Suspensión sugerida: 5 amarillas acumuladas (Art. 39). */
export function playersSuspendedByYellows(
  yellowCounts: Map<string, number>,
  threshold = 5,
): string[] {
  return [...yellowCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([personaId]) => personaId);
}
