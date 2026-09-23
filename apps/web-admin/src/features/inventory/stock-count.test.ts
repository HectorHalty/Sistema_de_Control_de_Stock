import { describe, expect, it } from 'vitest';
import type { Product } from '@/app/components/store';
import {
  buildStockCountAdjustments,
  syncStockEdits,
  type StockEdit,
} from '@/features/inventory/stock-count';

const product = (id: string, warehouseId: string, quantity: number): Product => ({
  id,
  name: id,
  code: id,
  description: '',
  category: 'Test',
  unit: 'unidades',
  image: '',
  stockByWarehouse: [{ warehouseId, quantity }],
});

describe('buildStockCountAdjustments', () => {
  it('sends the counted quantity, not a delta against a stale snapshot', () => {
    const adjustments = buildStockCountAdjustments(
      [{ productId: 'p1', warehouseId: 'w1', previousStock: 210, newStock: 0 }],
      [product('p1', 'w1', 10)],
    );
    expect(adjustments).toEqual([{ productId: 'p1', warehouseId: 'w1', quantity: 0 }]);
  });

  it('keeps one row when the same warehouse is edited twice', () => {
    const adjustments = buildStockCountAdjustments(
      [
        { productId: 'p1', warehouseId: 'w1', previousStock: 220, newStock: 10 },
        { productId: 'p1', warehouseId: 'w1', previousStock: 220, newStock: 10 },
      ],
      [product('p1', 'w1', 220)],
    );
    expect(adjustments).toEqual([{ productId: 'p1', warehouseId: 'w1', quantity: 10 }]);
  });

  it('skips rows whose counted stock already matches live stock', () => {
    const adjustments = buildStockCountAdjustments(
      [{ productId: 'p1', warehouseId: 'w1', previousStock: 10, newStock: 10 }],
      [product('p1', 'w1', 10)],
    );
    expect(adjustments).toEqual([]);
  });
});

describe('syncStockEdits', () => {
  it('refreshes previous stock from live products and keeps a dirty count', () => {
    const prev: StockEdit[] = [
      { productId: 'p1', warehouseId: 'w1', previousStock: 210, newStock: 0 },
    ];
    const next = syncStockEdits(prev, [product('p1', 'w1', 10)]);
    expect(next).toEqual([{ productId: 'p1', warehouseId: 'w1', previousStock: 10, newStock: 0 }]);
  });

  it('resets untouched rows when live stock changes', () => {
    const prev: StockEdit[] = [
      { productId: 'p1', warehouseId: 'w1', previousStock: 210, newStock: 210 },
    ];
    const next = syncStockEdits(prev, [product('p1', 'w1', 10)]);
    expect(next).toEqual([{ productId: 'p1', warehouseId: 'w1', previousStock: 10, newStock: 10 }]);
  });
});
