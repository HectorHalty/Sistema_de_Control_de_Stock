import { describe, expect, it } from 'vitest';
import type { Order, Product, StockMovement } from '@/app/components/store';
import { getStockAlertProducts } from '@/features/inventory/stock-alerts';

const product = (overrides: Partial<Product> & Pick<Product, 'id' | 'name'>): Product => ({
  code: overrides.id,
  description: '',
  category: 'Test',
  unit: 'unidades',
  image: '',
  stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }],
  ...overrides,
});

const sale = (productId: string, quantity: number): StockMovement => ({
  id: `m-${productId}-${quantity}`,
  createdAtISO: new Date().toISOString(),
  type: 'venta',
  productId,
  quantity: -Math.abs(quantity),
});

const pendingOrder = (productId: string, quantityOrdered: number): Order => ({
  id: `PED-${productId}`,
  date: '2026-09-22',
  provider: 'Proveedor',
  status: 'Pendiente',
  items: [{ productId, quantityOrdered }],
});

describe('getStockAlertProducts', () => {
  it('does not alert a product below 20 units when there is no consumption history', () => {
    const alerts = getStockAlertProducts(
      [product({ id: 'p1', name: 'Aceite', stockByWarehouse: [{ warehouseId: 'w1', quantity: 14 }] })],
      [],
      [],
    );
    expect(alerts).toEqual([]);
  });

  it('alerts when stock plus pending orders cannot cover weekly demand', () => {
    const alerts = getStockAlertProducts(
      [product({ id: 'p1', name: 'Aceite', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] })],
      [],
      [sale('p1', 200)],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].product.id).toBe('p1');
    expect(alerts[0].current).toBe(10);
    expect(alerts[0].pending).toBe(0);
    expect(alerts[0].weeklyAvg).toBeGreaterThan(alerts[0].current);
  });

  it('does not alert when a pending order covers the weekly deficit', () => {
    const alerts = getStockAlertProducts(
      [product({ id: 'p1', name: 'Aceite', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] })],
      [pendingOrder('p1', 250)],
      [sale('p1', 200)],
    );
    expect(alerts).toEqual([]);
  });
});
