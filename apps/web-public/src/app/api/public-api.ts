import { resolveApiBaseUrl } from './resolve-api-base-url';

const TOKEN_KEY = 'lch_public_token';

async function publicFetch<T>(
  path: string,
  init?: Omit<RequestInit, 'body'> & { token?: string; body?: unknown },
): Promise<T> {
  const { token, body, ...rest } = init ?? {};
  const headers: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers as Record<string, string>),
  };

  const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API ${path} → ${res.status}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    return (await res.text()) as T;
  }
  return res.json() as Promise<T>;
}

export type PublicRol = 'usuario' | 'seguidor' | 'jugador' | 'capitan';

export interface PublicSessionUser {
  id: string;
  email: string;
  nombre?: string | null;
  rol: PublicRol;
  avatarUrl?: string | null;
  dniConfirmado?: string | null;
  personaId?: string | null;
  equipoInscripcionId?: string | null;
  torneoId?: string | null;
  tieneStatsPersonales: boolean;
  needsDni: boolean;
  puedeSeguirEquipo: boolean;
  puedeSerCapitan: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicSessionUser;
  rol?: PublicRol;
}

export interface PublicTeamOption {
  equipoInscripcionId: string;
  name: string;
  shortName?: string | null;
  color?: string | null;
  categoria: string;
  torneoId: string;
}

export interface MeContext {
  user: PublicSessionUser;
  equipo: {
    name: string;
    shortName?: string | null;
    color?: string | null;
    categoria?: string;
  } | null;
  proximoPartido: {
    id: string;
    fecha: string;
    hora: string | null;
    cancha: string | null;
    local: string;
    visitante: string;
    esLocal: boolean;
  } | null;
  standingsPosition: unknown;
  personalStats: {
    goles: number;
    amarillas: number;
    rojas: number;
    suspensiones: unknown[];
  } | null;
  tieneStatsPersonales: boolean;
}

export interface CaptainTeamData {
  equipo: {
    id: string;
    name: string;
    shortName?: string | null;
    color?: string | null;
    categoria: string;
    maxPlantel: number;
  };
  torneo: { id: string; nombre: string; campeonato: string };
  plantel: RosterPlayer[];
  proximoPartido: {
    fecha: string;
    hora: string | null;
    cancha: string | null;
    rival: string;
  } | null;
}

export interface RosterPlayer {
  personaId: string;
  inscripcionId: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string | null;
  fechaNacimiento: string | null;
  numeroCamiseta: number | null;
  rolPlantel: string;
}

export const publicAuthStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string | null) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
};

export interface PublicMediaItem {
  id: string;
  title: string;
  type: string;
  url: string;
  mimeType: string;
  matchDate: string | null;
  createdAt: string;
}

export interface PublicHomeBundle {
  torneo: {
    id: string;
    nombre: string;
    categoria: string;
    categoriaCodigo: string;
    campeonato: string;
    temporada: string;
    anio: number;
  } | null;
  proximosPartidos: PublicMatchPreview[];
  standings: PublicStandingRow[];
  sponsors: PublicSponsor[];
  menuCount: number;
}

export interface PublicMatchPreview {
  id: string;
  fecha: string;
  hora: string | null;
  cancha: string | null;
  jornada: number | null;
  local: { id: string; name: string; shortName?: string | null };
  visitante: { id: string; name: string; shortName?: string | null };
}

export interface PublicStandingRow {
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
}

export interface PublicSponsor {
  id: string;
  name: string;
  imageUrl: string;
  placement: string;
  bannerLabel?: string | null;
  mediaType?: string;
  widthPx?: number | null;
  heightPx?: number | null;
  linkUrl?: string | null;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PublicMenuFilter {
  slug: string;
  label: string;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  category: string;
  categorySlug?: string;
  price: number;
  emoji?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  kitchen: string;
  popular?: boolean;
  filters?: string[];
}

export interface PublicMenuResponse {
  items: PublicMenuItem[];
  categories: PublicMenuCategory[];
  filters: PublicMenuFilter[];
}

export interface PublicTorneoSummary {
  id: string;
  nombre: string;
  categoria: string;
  categoriaCodigo: string;
  categoriaColor?: string | null;
  campeonato: string;
  temporada: string;
}

export interface PublicTorneoDetail {
  torneo: {
    id: string;
    nombre: string;
    categoria: string;
    campeonato: string;
    temporada: string;
  };
  standings: PublicStandingRow[];
  equipos: { id: string; name: string; shortName?: string | null; color?: string | null }[];
  partidos: {
    id: string;
    fecha: string;
    hora: string | null;
    cancha: string | null;
    jornada: number | null;
    status: string;
    homeGoals: number | null;
    awayGoals: number | null;
    local: string;
    visitante: string;
  }[];
  goleadores: PublicTopScorer[];
  suspensiones: PublicSuspension[];
  tarjetas: PublicTarjeta[];
}

export interface PublicTarjeta {
  id: string;
  jugador: string;
  equipo: string;
  tipo: string;
  tipoLabel: string;
  minuto: number | null;
  jornada: number | null;
  partido: string;
  fecha: string;
}

export interface PublicSuspension {
  id: string;
  jugador: string;
  dni: string | null;
  equipo: string;
  motivo: string;
  fechasRestantes: number;
}

export interface PublicTopScorer {
  rank: number;
  personaId: string;
  player: string;
  team: string;
  goals: number;
}

export interface ReglamentoArticulo {
  id: string;
  numero: string;
  contenido: string;
  aplicable: boolean;
}

export interface ReglamentoApartado {
  id: string;
  numero: number;
  titulo: string;
  articulos: ReglamentoArticulo[];
}

export interface PublicOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  ticketNumber: number | null;
  items: {
    id: string;
    name: string;
    unitPrice: number;
    quantity: number;
    salesProductId: string | null;
  }[];
  qr: {
    token: string;
    usado: boolean;
    invalido: boolean;
  } | null;
}

export const publicApi = {
  homeBundle: () => publicFetch<PublicHomeBundle>('/public/home-bundle'),
  torneo: (id?: string, categoria?: string) => {
    const params = new URLSearchParams();
    if (id) params.set('id', id);
    else if (categoria) params.set('categoria', categoria);
    const q = params.toString();
    return publicFetch<PublicTorneoDetail | null>(`/public/torneo${q ? `?${q}` : ''}`);
  },
  torneos: () => publicFetch<PublicTorneoSummary[]>('/public/torneos'),
  menu: () => publicFetch<PublicMenuResponse>('/public/menu'),
  reglamento: () => publicFetch<{ apartados: ReglamentoApartado[]; anexos: unknown[] }>('/public/reglamento'),
  sponsors: () => publicFetch<PublicSponsor[]>('/public/sponsors'),

  auth: {
    register: (data: { email: string; password: string; nombre: string; dni: string }) =>
      publicFetch<AuthResponse>('/public/auth/register', { method: 'POST', body: data }),
    login: (email: string, password: string) =>
      publicFetch<AuthResponse>('/public/auth/login', { method: 'POST', body: { email, password } }),
    loginGoogle: (idToken: string) =>
      publicFetch<AuthResponse>('/public/auth/google', { method: 'POST', body: { idToken } }),
    loginDev: (email: string, name: string) =>
      publicFetch<AuthResponse>('/public/auth/dev', { method: 'POST', body: { email, name } }),
    completeDni: (dni: string, token: string) =>
      publicFetch<AuthResponse>('/public/auth/complete-dni', {
        method: 'POST',
        token,
        body: { dni },
      }),
  },

  me: {
    context: (token: string) => publicFetch<MeContext>('/public/me/context', { token }),
    followTeam: (equipoInscripcionId: string, token: string) =>
      publicFetch<AuthResponse>('/public/me/follow-team', {
        method: 'PUT',
        token,
        body: { equipoInscripcionId },
      }),
    unfollowTeam: (token: string) =>
      publicFetch<AuthResponse>('/public/me/follow-team', { method: 'DELETE', token }),
  },

  teams: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return publicFetch<PublicTeamOption[]>(`/public/teams${q}`);
  },

  captain: {
    getTeam: (token: string) => publicFetch<CaptainTeamData>('/public/captain/team', { token }),
    addPlayer: (data: Omit<RosterPlayer, 'personaId' | 'inscripcionId'>, token: string) =>
      publicFetch<CaptainTeamData>('/public/captain/roster', { method: 'POST', token, body: data }),
    updatePlayer: (personaId: string, data: Partial<RosterPlayer>, token: string) =>
      publicFetch<CaptainTeamData>(`/public/captain/roster/${personaId}`, {
        method: 'PUT',
        token,
        body: data,
      }),
    removePlayer: (personaId: string, token: string) =>
      publicFetch<CaptainTeamData>(`/public/captain/roster/${personaId}`, {
        method: 'DELETE',
        token,
      }),
    getListaBuenaFe: (token: string) =>
      publicFetch<string>('/public/captain/roster/lista-buena-fe', { token }),
  },

  media: (type?: string) => {
    const q = type ? `?type=${encodeURIComponent(type)}` : '';
    return publicFetch<PublicMediaItem[]>(`/public/media${q}`);
  },

  orders: {
    checkout: (
      items: { salesProductId: string; quantity: number }[],
      token: string,
      idempotencyKey?: string,
    ) =>
      publicFetch<PublicOrder>('/public/orders/checkout', {
        method: 'POST',
        token,
        body: { items, idempotencyKey },
      }),
    list: (token: string) => publicFetch<PublicOrder[]>('/public/orders', { token }),
    get: (id: string, token: string) => publicFetch<PublicOrder>(`/public/orders/${id}`, { token }),
  },
};
