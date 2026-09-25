import { describe, expect, it } from 'vitest';
import type { Order, Product, StockMovement } from '@/app/components/store';
import { getStockAlertProducts, isAlertDay, selectStockAlerts } from '@/features/inventory/stock-alerts';

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

const wednesday = new Date('2026-09-23T15:00:00-03:00');

describe('selectStockAlerts', () => {
  const low = product({ id: 'p1', name: 'TEST-ALERTA', stockByWarehouse: [{ warehouseId: 'w1', quantity: 8 }] });

  it('conoce el miércoles 2026-09-23 como Miercoles, sin acento', () => {
    expect(isAlertDay(wednesday, 'Miercoles')).toBe(true);
    expect(isAlertDay(wednesday, 'Jueves')).toBe(false);
  });

  it('la semanal no sale si hoy no es el día elegido', () => {
    const alerts = selectStockAlerts({
      products: [low],
      orders: [],
      movements: [sale('p1', 200)],
      lowStockNotifications: true,
      autoAlerts: false,
      autoAlertMinimum: 20,
      alertDay: 'Jueves',
      today: wednesday,
    });
    expect(alerts).toEqual([]);
  });

  it('la semanal sale el día elegido', () => {
    const alerts = selectStockAlerts({
      products: [low],
      orders: [],
      movements: [sale('p1', 200)],
      lowStockNotifications: true,
      autoAlerts: false,
      autoAlertMinimum: 20,
      alertDay: 'Miercoles',
      today: wednesday,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].current).toBe(8);
    expect(alerts[0].weeklyAvg).toBeGreaterThan(8);
  });

  it('la automática avisa por debajo del mínimo aunque no haya ventas ni stock bajo', () => {
    const alerts = selectStockAlerts({
      products: [low],
      orders: [],
      movements: [],
      lowStockNotifications: false,
      autoAlerts: true,
      autoAlertMinimum: 20,
      alertDay: 'Jueves',
      today: wednesday,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].product.id).toBe('p1');
    expect(alerts[0].weeklyAvg).toBe(0);
  });

  it('con la automática apagada, un producto sin ventas no entra', () => {
    const alerts = selectStockAlerts({
      products: [product({ id: 'p2', name: 'TEST', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] })],
      orders: [],
      movements: [],
      lowStockNotifications: true,
      autoAlerts: false,
      autoAlertMinimum: 20,
      alertDay: 'Miercoles',
      today: wednesday,
    });
    expect(alerts).toEqual([]);
  });

  it('si cumplen las dos reglas, queda una sola fila y es la semanal', () => {
    const alerts = selectStockAlerts({
      products: [low],
      orders: [],
      movements: [sale('p1', 200)],
      lowStockNotifications: true,
      autoAlerts: true,
      autoAlertMinimum: 20,
      alertDay: 'Miercoles',
      today: wednesday,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].weeklyAvg).toBeGreaterThan(0);
  });

  it('un pendiente que cubre la semana saca la semanal; la automática queda si sigue debajo del mínimo', () => {
    const covered = selectStockAlerts({
      products: [low],
      orders: [pendingOrder('p1', 250)],
      movements: [sale('p1', 200)],
      lowStockNotifications: true,
      autoAlerts: false,
      autoAlertMinimum: 20,
      alertDay: 'Miercoles',
      today: wednesday,
    });
    expect(covered).toEqual([]);

    const stillAuto = selectStockAlerts({
      products: [low],
      orders: [pendingOrder('p1', 250)],
      movements: [sale('p1', 200)],
      lowStockNotifications: true,
      autoAlerts: true,
      autoAlertMinimum: 20,
      alertDay: 'Miercoles',
      today: wednesday,
    });
    expect(stillAuto).toHaveLength(1);
    expect(stillAuto[0].weeklyAvg).toBeGreaterThan(0);
    expect(stillAuto[0].pending).toBe(250);
  });
});
