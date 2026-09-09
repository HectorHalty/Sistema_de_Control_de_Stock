import type {
  CaptainTeamData, MeContext, PublicMatchPreview, PublicRol,
  PublicSessionUser, PublicStandingRow, PublicTeamOption, RosterPlayer,
} from '../api/public-api';

export const USE_MOCK_FUTBOL = true;

const FOLLOW_KEY = 'lch_mock_followed_team';

// ---------- Fixtures ----------

const TORNEO = { id: 'trn-apertura', nombre: 'Torneo Apertura', categoria: 'Libre A' };

const TEAMS: PublicTeamOption[] = [
  { equipoInscripcionId: 'ei-halcones', name: 'Los Halcones', shortName: 'HAL', color: '#6BFF9E', categoria: 'Libre A', torneoId: TORNEO.id },
  { equipoInscripcionId: 'ei-depredadores', name: 'Depredadores FC', shortName: 'DEP', color: '#f87171', categoria: 'Libre A', torneoId: TORNEO.id },
  { equipoInscripcionId: 'ei-truenos', name: 'Truenos del Sur', shortName: 'TRU', color: '#60a5fa', categoria: 'Libre A', torneoId: TORNEO.id },
  { equipoInscripcionId: 'ei-tromba', name: 'La Tromba', shortName: 'TRB', color: '#fbbf24', categoria: 'Libre A', torneoId: TORNEO.id },
];

const STANDINGS: PublicStandingRow[] = [
  row('ei-depredadores', 'Depredadores FC', 8, 6, 1, 1, 19, 8),
  row('ei-truenos', 'Truenos del Sur', 8, 5, 2, 1, 16, 9),
  row('ei-halcones', 'Los Halcones', 8, 4, 2, 2, 14, 11),
  row('ei-tromba', 'La Tromba', 8, 3, 2, 3, 12, 13),
  row('ei-ph5', 'Real Potrero', 8, 2, 2, 4, 9, 15),
  row('ei-ph6', 'Sporting Asado', 8, 1, 1, 6, 7, 22),
];

function row(id: string, name: string, pj: number, pg: number, pe: number, pp: number, gf: number, gc: number): PublicStandingRow {
  return {
    inscripcionId: id, teamId: id, teamName: name,
    played: pj, won: pg, drawn: pe, lost: pp,
    goalsFor: gf, goalsAgainst: gc, goalDiff: gf - gc, points: pg * 3 + pe,
  };
}

const PROXIMOS: PublicMatchPreview[] = [
  { id: 'm1', fecha: iso(3), hora: '14:00', cancha: 'Cancha 1', jornada: 9,
    local: { id: 'ei-halcones', name: 'Los Halcones', shortName: 'HAL' },
    visitante: { id: 'ei-depredadores', name: 'Depredadores FC', shortName: 'DEP' } },
  { id: 'm2', fecha: iso(3), hora: '15:30', cancha: 'Cancha 2', jornada: 9,
    local: { id: 'ei-truenos', name: 'Truenos del Sur', shortName: 'TRU' },
    visitante: { id: 'ei-tromba', name: 'La Tromba', shortName: 'TRB' } },
];

const RESULTADOS = [
  { id: 'r1', local: 'Los Halcones', visitante: 'Real Potrero', golesLocal: 3, golesVisitante: 1, fecha: iso(-4) },
  { id: 'r2', local: 'Depredadores FC', visitante: 'Los Halcones', golesLocal: 2, golesVisitante: 2, fecha: iso(-11) },
  { id: 'r3', local: 'La Tromba', visitante: 'Truenos del Sur', golesLocal: 0, golesVisitante: 1, fecha: iso(-11) },
];

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

// Roster del capitán (Los Halcones)
const HALCONES_ROSTER: RosterPlayer[] = [
  rp('p-juan', 'Juan', 'Pérez', '30123456', 'jugador@lachacra.test', 10, 'jugador'),
  rp('p-cap', 'Carlos', 'Capitán', '28123456', 'capitan@lachacra.test', 5, 'capitan'),
  rp('p-otro', 'Diego', 'Suárez', '27333444', 'otro.jugador@mail.com', 7, 'jugador'),
  rp('p-4', 'Nicolás', 'Gómez', '31222333', null, 1, 'jugador'),
  rp('p-5', 'Martín', 'Ríos', '32111000', null, 4, 'jugador'),
  rp('p-6', 'Lucas', 'Fernández', '33444555', null, 8, 'jugador'),
  rp('p-7', 'Bruno', 'Acosta', '29888777', null, 9, 'jugador'),
  rp('p-8', 'Pablo', 'Vega', '30999888', null, 11, 'jugador'),
];

function rp(personaId: string, nombre: string, apellido: string, dni: string, email: string | null, camiseta: number, rolPlantel: string): RosterPlayer {
  return { personaId, inscripcionId: `insc-${personaId}`, nombre, apellido, dni, email,
    fechaNacimiento: '1996-04-12', numeroCamiseta: camiseta, rolPlantel };
}

// Jugadores fixture (para resolveMockRole): email de login esperado por DNI
const JUGADOR_FIXTURE = { email: 'jugador@lachacra.test', dni: '30123456', equipo: 'Los Halcones', equipoInscripcionId: 'ei-halcones' };
const CAPITAN_FIXTURE = { email: 'capitan@lachacra.test', dni: '28123456', equipo: 'Los Halcones', equipoInscripcionId: 'ei-halcones' };

// ---------- Resolvers ----------

function getFollowed(): string | null {
  try { return localStorage.getItem(FOLLOW_KEY); } catch { return null; }
}

export function resolveMockRole(user: PublicSessionUser): MockRoleResult {
  const email = user.email.trim().toLowerCase();
  const dni = user.dniConfirmado ?? null;

  if (dni === CAPITAN_FIXTURE.dni && email === CAPITAN_FIXTURE.email) return { rol: 'capitan' };
  if (dni === JUGADOR_FIXTURE.dni && email === JUGADOR_FIXTURE.email) return { rol: 'jugador' };

  if (dni) {
    const rosterHit = HALCONES_ROSTER.find((p) => p.dni === dni);
    if (rosterHit && (rosterHit.email ?? '').toLowerCase() !== email) {
      return { rol: 'usuario', dniEnPlantelOtroEmail: 'Los Halcones' };
    }
  }

  if (getFollowed()) return { rol: 'seguidor' };
  return { rol: 'usuario' };
}

export type MockRoleResult = { rol: PublicRol; dniEnPlantelOtroEmail?: string };

function teamByInscripcion(id: string | null): PublicTeamOption | undefined {
  return id ? TEAMS.find((t) => t.equipoInscripcionId === id) : undefined;
}

function standingFor(id: string): PublicStandingRow | null {
  return STANDINGS.find((s) => s.inscripcionId === id) ?? null;
}

function proximoPara(equipoInscripcionId: string): MeContext['proximoPartido'] {
  const m = PROXIMOS.find((p) => p.local.id === equipoInscripcionId || p.visitante.id === equipoInscripcionId);
  if (!m) return null;
  return {
    id: m.id, fecha: m.fecha, hora: m.hora, cancha: m.cancha,
    local: m.local.name, visitante: m.visitante.name,
    esLocal: m.local.id === equipoInscripcionId,
  };
}

export function resolveMockContext(user: PublicSessionUser): MeContext {
  const { rol } = resolveMockRole(user);
  const base: MeContext = {
    user: { ...user, rol },
    equipo: null, proximoPartido: null, standingsPosition: null,
    personalStats: null, tieneStatsPersonales: rol === 'jugador',
  };

  let equipoInscripcionId: string | null = null;
  if (rol === 'jugador' || rol === 'capitan') equipoInscripcionId = 'ei-halcones';
  else if (rol === 'seguidor') equipoInscripcionId = getFollowed();

  if (equipoInscripcionId) {
    const team = teamByInscripcion(equipoInscripcionId);
    base.equipo = team ? { name: team.name, shortName: team.shortName, color: team.color, categoria: team.categoria } : null;
    base.proximoPartido = proximoPara(equipoInscripcionId);
    base.standingsPosition = standingFor(equipoInscripcionId);
  }

  if (rol === 'jugador') {
    base.personalStats = { goles: 3, amarillas: 1, rojas: 0, suspensiones: [] };
  }

  return base;
}

export function resolveMockCaptainTeam(user: PublicSessionUser): CaptainTeamData | null {
  if (resolveMockRole(user).rol !== 'capitan') return null;
  return {
    equipo: { id: 'ei-halcones', name: 'Los Halcones', shortName: 'HAL', color: '#6BFF9E', categoria: 'Libre A', maxPlantel: 18 },
    torneo: { id: TORNEO.id, nombre: TORNEO.nombre, campeonato: 'Apertura 2026' },
    plantel: HALCONES_ROSTER,
    proximoPartido: { fecha: iso(3), hora: '14:00', cancha: 'Cancha 1', rival: 'Depredadores FC' },
  };
}

export function listMockTeams(search?: string): PublicTeamOption[] {
  const q = (search ?? '').trim().toLowerCase();
  return q ? TEAMS.filter((t) => t.name.toLowerCase().includes(q)) : TEAMS;
}

export function mockFollowTeam(user: PublicSessionUser, equipoInscripcionId: string): MeContext {
  try { localStorage.setItem(FOLLOW_KEY, equipoInscripcionId); } catch { /* noop */ }
  return resolveMockContext(user);
}

export function mockUnfollowTeam(user: PublicSessionUser): MeContext {
  try { localStorage.removeItem(FOLLOW_KEY); } catch { /* noop */ }
  return resolveMockContext(user);
}

export function mockTorneoPublico() {
  return { torneo: TORNEO, standings: STANDINGS, proximosPartidos: PROXIMOS, resultados: RESULTADOS };
}
