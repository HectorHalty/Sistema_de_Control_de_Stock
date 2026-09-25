import { describe, expect, it } from 'vitest';
import { ADJUSTMENT_REASON_LABELS, ADJUSTMENT_REASONS, stockAdjustmentError } from './stock-adjustment';

describe('stockAdjustmentError', () => {
  const base = { warehouseId: 'w1', quantity: -3, reason: 'rotura' as const, available: 20 };

  it('acepta una baja que el almacén puede cubrir', () => {
    expect(stockAdjustmentError(base)).toBeNull();
  });

  it('acepta una entrada directa, que no consume stock', () => {
    expect(stockAdjustmentError({ ...base, quantity: 12, reason: 'entrada_directa' })).toBeNull();
  });

  it('rechaza almacén vacío, cantidad inválida, faltante y motivo sin elegir', () => {
    expect(stockAdjustmentError({ ...base, warehouseId: '' })).toMatch(/almacén/);
    expect(stockAdjustmentError({ ...base, quantity: 0 })).toMatch(/no puede ser 0/);
    expect(stockAdjustmentError({ ...base, quantity: Number.NaN })).toMatch(/no puede ser 0/);
    expect(stockAdjustmentError({ ...base, quantity: -21 })).toMatch(/suficiente/);
    expect(stockAdjustmentError({ ...base, reason: '' })).toMatch(/motivo/);
  });

  it('expone los cuatro motivos con su etiqueta en español', () => {
    expect(ADJUSTMENT_REASONS).toEqual(['rotura', 'vencido', 'correccion', 'entrada_directa']);
    expect(ADJUSTMENT_REASON_LABELS.correccion).toBe('Corrección de carga');
  });
});
