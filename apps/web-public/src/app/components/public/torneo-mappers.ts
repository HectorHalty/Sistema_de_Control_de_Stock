import type {
  PublicMatchPreview,
  PublicStandingRow,
  PublicTorneoDetail,
} from '../../api/public-api';
import {
  DEMO_NEXT_MATCH,
  DEMO_RECENT_RESULTS,
  DEMO_STANDINGS,
  DEMO_TOP_SCORERS,
} from './demo-torneo';

export interface UiStandingRow {
  pos: number;
  team: string;
  abbr: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  pts: number;
}

export interface UiRecentResult {
  id: string;
  local: string;
  visitante: string;
  homeGoals: number;
  awayGoals: number;
  date: string;
  cancha?: string | null;
}

export interface UiNextMatch {
  local: string;
  visitante: string;
  fecha: string;
  hora: string | null;
  cancha: string | null;
  jornada: number | null;
}

function formatMatchDateShort(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(iso))
    .replace('.', '');
}

function teamAbbr(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }
  return name.slice(0, 3).toUpperCase();
}

export function mapStandingsFromApi(rows: PublicStandingRow[]): UiStandingRow[] {
  return rows.map((row, idx) => ({
    pos: idx + 1,
    team: row.teamName,
    abbr: teamAbbr(row.teamName),
    pj: row.played,
    pg: row.won,
    pe: row.drawn,
    pp: row.lost,
    gf: row.goalsFor,
    gc: row.goalsAgainst,
    pts: row.points,
  }));
}

export function mapRecentResultsFromTorneo(
  detail: PublicTorneoDetail | null | undefined,
): UiRecentResult[] {
  if (!detail?.partidos.length) return [];

  return detail.partidos
    .filter((p) => p.status === 'jugado' && p.homeGoals != null && p.awayGoals != null)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      local: p.local,
      visitante: p.visitante,
      homeGoals: p.homeGoals!,
      awayGoals: p.awayGoals!,
      date: formatMatchDateShort(p.fecha),
      cancha: p.cancha,
    }));
}

export function mapNextMatchFromPreview(preview: PublicMatchPreview | undefined): UiNextMatch | null {
  if (!preview) return null;
  return {
    local: preview.local.name,
    visitante: preview.visitante.name,
    fecha: formatMatchDateShort(preview.fecha),
    hora: preview.hora,
    cancha: preview.cancha,
    jornada: preview.jornada,
  };
}

export function resolveStandings(apiRows: PublicStandingRow[] | undefined, useDemo: boolean) {
  if (!useDemo && apiRows?.length) return mapStandingsFromApi(apiRows);
  return DEMO_STANDINGS;
}

export function resolveRecentResults(
  detail: PublicTorneoDetail | null | undefined,
  useDemo: boolean,
) {
  if (!useDemo) {
    const fromApi = mapRecentResultsFromTorneo(detail);
    if (fromApi.length) return fromApi;
  }
  return DEMO_RECENT_RESULTS;
}

export function resolveNextMatch(
  meMatch: UiNextMatch | null,
  preview: PublicMatchPreview | undefined,
  useDemo: boolean,
): UiNextMatch {
  if (meMatch) return meMatch;
  const fromPreview = mapNextMatchFromPreview(preview);
  if (fromPreview) return fromPreview;
  if (!useDemo) {
    return {
      local: '',
      visitante: '',
      fecha: '',
      hora: null,
      cancha: null,
      jornada: null,
    };
  }
  return DEMO_NEXT_MATCH;
}

export { DEMO_TOP_SCORERS };
