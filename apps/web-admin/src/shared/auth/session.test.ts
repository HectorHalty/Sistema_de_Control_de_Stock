import { afterEach, describe, expect, it } from 'vitest';
import { storageKeys } from '@/shared/storage/keys';
import { getSessionUserId, getSessionUserRole } from './session';

afterEach(() => {
  localStorage.removeItem(storageKeys.auth.user);
});

describe('getSessionUserRole', () => {
  it('devuelve null si no hay sesión', () => {
    expect(getSessionUserRole()).toBeNull();
  });

  it('lee el rol de lch-auth-user', () => {
    localStorage.setItem(
      storageKeys.auth.user,
      JSON.stringify({ id: '550e8400-e29b-41d4-a716-446655440000', role: 'Vendedor' }),
    );
    expect(getSessionUserRole()).toBe('Vendedor');
  });

  it('devuelve null si el JSON está roto', () => {
    localStorage.setItem(storageKeys.auth.user, '{nope');
    expect(getSessionUserRole()).toBeNull();
    expect(getSessionUserId()).toBeNull();
  });
});
