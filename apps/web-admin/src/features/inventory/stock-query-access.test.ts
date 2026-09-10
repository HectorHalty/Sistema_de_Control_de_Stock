import { describe, expect, it } from 'vitest';
import { canQueryStockAdmin, canQueryStockCatalog } from './stock-query-access';

describe('stock-query-access', () => {
  it('Vendedor y Gerente leen catálogo POS, no el admin de inventario', () => {
    expect(canQueryStockCatalog('Vendedor')).toBe(true);
    expect(canQueryStockCatalog('Gerente_Ventas')).toBe(true);
    expect(canQueryStockAdmin('Vendedor')).toBe(false);
    expect(canQueryStockAdmin('Gerente_Ventas')).toBe(false);
  });

  it('Operador_Stock y SuperAdmin leen catálogo y admin', () => {
    expect(canQueryStockCatalog('Operador_Stock')).toBe(true);
    expect(canQueryStockAdmin('Operador_Stock')).toBe(true);
    expect(canQueryStockCatalog('SuperAdmin')).toBe(true);
    expect(canQueryStockAdmin('SuperAdmin')).toBe(true);
    expect(canQueryStockCatalog('Admin')).toBe(true);
    expect(canQueryStockAdmin('Admin')).toBe(true);
  });

  it('fútbol/cocina y sesión vacía no disparan nada', () => {
    expect(canQueryStockCatalog('Operador_Futbol')).toBe(false);
    expect(canQueryStockCatalog('Operador_Cocina')).toBe(false);
    expect(canQueryStockCatalog(null)).toBe(false);
    expect(canQueryStockCatalog('')).toBe(false);
    expect(canQueryStockAdmin(null)).toBe(false);
  });
});
