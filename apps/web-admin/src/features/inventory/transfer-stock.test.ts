import { describe, expect, it } from 'vitest';
import { transferStockError } from './transfer-stock';

describe('transferStockError', () => {
  const base = { fromWarehouseId: 'a', toWarehouseId: 'b', quantity: 5, available: 20 };

  it('acepta un pasaje que el origen puede cubrir', () => {
    expect(transferStockError(base)).toBeNull();
  });

  it('rechaza el mismo almacén, cantidad inválida y faltante', () => {
    expect(transferStockError({ ...base, toWarehouseId: 'a' })).toMatch(/distintos/);
    expect(transferStockError({ ...base, quantity: 0 })).toMatch(/mayor a 0/);
    expect(transferStockError({ ...base, quantity: 21 })).toMatch(/suficiente/);
    expect(transferStockError({ ...base, fromWarehouseId: '' })).toMatch(/origen/);
  });
});