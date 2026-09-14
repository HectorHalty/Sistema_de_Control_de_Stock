import { describe, it, expect } from 'vitest';
import { googleEnabled, shouldShowOnboarding } from './auth-helpers';
import type { PublicSessionUser } from '../../../api/public-api';

const user = (rol: PublicSessionUser['rol']): PublicSessionUser =>
  ({ id: 'u', email: 'a@b.com', rol, tieneStatsPersonales: false, needsDni: false,
     puedeSeguirEquipo: true, puedeSerCapitan: false } as PublicSessionUser);

describe('googleEnabled', () => {
  it('true sólo con un client id no vacío', () => {
    expect(googleEnabled('abc.apps.googleusercontent.com')).toBe(true);
    expect(googleEnabled('')).toBe(false);
    expect(googleEnabled('   ')).toBe(false);
    expect(googleEnabled(undefined)).toBe(false);
    expect(googleEnabled(null)).toBe(false);
  });
});

describe('shouldShowOnboarding', () => {
  it('true para usuario no descartado', () => {
    expect(shouldShowOnboarding(user('usuario'), false)).toBe(true);
  });
  it('false si ya se descartó', () => {
    expect(shouldShowOnboarding(user('usuario'), true)).toBe(false);
  });
  it('false para roles ya decididos', () => {
    expect(shouldShowOnboarding(user('seguidor'), false)).toBe(false);
    expect(shouldShowOnboarding(user('jugador'), false)).toBe(false);
    expect(shouldShowOnboarding(user('capitan'), false)).toBe(false);
  });
  it('false para anónimo', () => {
    expect(shouldShowOnboarding(null, false)).toBe(false);
  });
});
