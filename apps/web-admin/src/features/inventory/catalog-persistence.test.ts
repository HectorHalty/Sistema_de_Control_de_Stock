import { describe, expect, it } from 'vitest';
import {
  mergeServerWithPendingLocal,
  resolveCategoryForProduct,
  uuidProductIds,
} from './catalog-persistence';

const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

describe('mergeServerWithPendingLocal', () => {
  it('conserva proveedores locales pendientes y deja el servidor primero', () => {
    const server = [{ id: UUID_A, name: 'Acme' }];
    const prev = [
      { id: UUID_A, name: 'Acme viejo' },
      { id: 'sup1777', name: 'Nuevo local' },
    ];
    const merged = mergeServerWithPendingLocal(server, prev, {
      nameOf: s => s.name,
      sort: (a, b) => a.name.localeCompare(b.name, 'es'),
    });
    expect(merged.map(s => s.id)).toEqual([UUID_A, 'sup1777']);
    expect(merged[0].name).toBe('Acme');
  });

  it('descarta el pendiente si el servidor ya tiene el mismo nombre', () => {
    const server = [{ id: UUID_B, name: 'Nuevo local' }];
    const prev = [{ id: 'sup1777', name: 'Nuevo local' }];
    const merged = mergeServerWithPendingLocal(server, prev, { nameOf: s => s.name });
    expect(merged).toEqual(server);
  });

  it('conserva pedidos locales (id no UUID) al hidratar si keepPendingLocal no se apaga', () => {
    const server = [{ id: UUID_A, provider: 'API' }];
    const prev = [{ id: 'PED-001', provider: 'Local' }];
    const merged = mergeServerWithPendingLocal(server, prev);
    expect(merged.map(o => o.id)).toEqual([UUID_A, 'PED-001']);
  });

  it('descarta PED locales cuando keepPendingLocal es false (API estricta)', () => {
    const server = [{ id: UUID_A, provider: 'API' }];
    const prev = [{ id: 'PED-001', provider: 'Local' }];
    const merged = mergeServerWithPendingLocal(server, prev, { keepPendingLocal: false });
    expect(merged.map(o => o.id)).toEqual([UUID_A]);
  });
});

describe('uuidProductIds', () => {
  it('filtra ids locales y duplicados', () => {
    expect(uuidProductIds(['p173', UUID_A, 'cat1', UUID_A, '', UUID_B])).toEqual([UUID_A, UUID_B]);
  });
});

describe('resolveCategoryForProduct', () => {
  it('devuelve el UUID persistido por nombre', () => {
    const cats = [
      { id: UUID_A, name: 'Bebidas' },
      { id: 'cat1777', name: 'Snacks' },
    ];
    expect(resolveCategoryForProduct(cats, 'bebidas')).toEqual({ id: UUID_A, name: 'Bebidas' });
  });

  it('rechaza un id local para no mandarlo en el POST', () => {
    expect(() =>
      resolveCategoryForProduct([{ id: 'cat1777', name: 'Nueva' }], 'Nueva'),
    ).toThrow(/no está sincronizada/);
  });

  it('rechaza categoría inexistente', () => {
    expect(() => resolveCategoryForProduct([{ id: UUID_A, name: 'Bebidas' }], 'Otra')).toThrow(
      /no encontrada/i,
    );
  });
});
