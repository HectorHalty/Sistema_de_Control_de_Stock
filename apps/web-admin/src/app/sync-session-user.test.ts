import { describe, expect, it } from 'vitest';
import { persistedUserIsStale } from './sync-session-user';
import type { CurrentUser } from '@/features/platform/types';

const vendedor: CurrentUser = { id: 'u-v', username: 'vendedor', role: 'Vendedor' };
const gerente: CurrentUser = { id: 'u-g', username: 'gerente', role: 'Gerente_Ventas' };
const emptyDefault: CurrentUser = { username: '', role: 'Vendedor' };

describe('persistedUserIsStale', () => {
  it('es true cuando el persistido es el default vacío y la sesión es gerente', () => {
    expect(persistedUserIsStale(emptyDefault, gerente)).toBe(true);
  });

  it('es true cuando el persistido es Vendedor y la sesión es Gerente_Ventas', () => {
    expect(persistedUserIsStale(vendedor, gerente)).toBe(true);
  });

  it('es true si cambia solo el id', () => {
    expect(
      persistedUserIsStale(
        { id: 'a', username: 'gerente', role: 'Gerente_Ventas' },
        { id: 'b', username: 'gerente', role: 'Gerente_Ventas' },
      ),
    ).toBe(true);
  });

  it('es false cuando id, role y username coinciden', () => {
    expect(persistedUserIsStale(gerente, { ...gerente })).toBe(false);
  });
});
