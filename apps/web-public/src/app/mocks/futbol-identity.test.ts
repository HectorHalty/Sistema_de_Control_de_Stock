import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveMockRole, resolveMockContext, mockTorneoPublico, listMockTeams,
} from './futbol-identity';
import type { PublicSessionUser } from '../api/public-api';

const acc = (over: Partial<PublicSessionUser>): PublicSessionUser =>
  ({ id: 'u', email: 'nadie@mail.com', rol: 'usuario', tieneStatsPersonales: false,
     needsDni: true, puedeSeguirEquipo: true, puedeSerCapitan: false, ...over } as PublicSessionUser);

beforeEach(() => localStorage.clear());

describe('resolveMockRole', () => {
  it('sin DNI confirmado → usuario', () => {
    expect(resolveMockRole(acc({ dniConfirmado: null }))).toEqual({ rol: 'usuario' });
  });
  it('email + DNI del jugador fixture → jugador', () => {
    expect(resolveMockRole(acc({ email: 'jugador@lachacra.test', dniConfirmado: '30123456' })))
      .toEqual({ rol: 'jugador' });
  });
  it('email + DNI del capitán fixture → capitan', () => {
    expect(resolveMockRole(acc({ email: 'capitan@lachacra.test', dniConfirmado: '28123456' })))
      .toEqual({ rol: 'capitan' });
  });
  it('DNI en un plantel pero email distinto → usuario + dniEnPlantelOtroEmail', () => {
    const r = resolveMockRole(acc({ email: 'otromail@x.com', dniConfirmado: '27333444' }));
    expect(r.rol).toBe('usuario');
    expect(r.dniEnPlantelOtroEmail).toBe('Los Halcones');
  });
  it('sigue un equipo → seguidor', () => {
    localStorage.setItem('lch_mock_followed_team', 'ei-halcones');
    expect(resolveMockRole(acc({ dniConfirmado: null })).rol).toBe('seguidor');
  });
});

describe('resolveMockContext (jugador fixture)', () => {
  it('devuelve un MeContext con la forma correcta', () => {
    const ctx = resolveMockContext(acc({ email: 'jugador@lachacra.test', dniConfirmado: '30123456' }));
    expect(ctx.equipo?.name).toBe('Los Halcones');
    expect(ctx.proximoPartido).not.toBeNull();
    expect(ctx.standingsPosition).not.toBeNull();
    expect(ctx.personalStats).toMatchObject({ goles: 3, amarillas: 1, rojas: 0 });
    expect(ctx.tieneStatsPersonales).toBe(true);
  });
});

describe('mockTorneoPublico', () => {
  it('tabla no vacía y sin resaltar', () => {
    const t = mockTorneoPublico();
    expect(t.standings.length).toBeGreaterThanOrEqual(4);
    expect(t.proximosPartidos.length).toBeGreaterThan(0);
    expect(t.torneo.nombre).toBeTruthy();
  });
});

describe('listMockTeams', () => {
  it('filtra por nombre', () => {
    expect(listMockTeams('halc').map((x) => x.name)).toContain('Los Halcones');
    expect(listMockTeams('zzz')).toHaveLength(0);
  });
});
