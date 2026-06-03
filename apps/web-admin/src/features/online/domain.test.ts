import { describe, expect, it } from 'vitest';
import { checkoutOnlineOrder } from './domain';
import type { SalesMenuProduct, SalesOrderItem, StockProduct } from '@/features/sales/menu-types';

const menu: SalesMenuProduct[] = [
  {
    id: 'menu-1',
    name: 'Hamburguesa',
    category: 'Comidas',
    station: 'Parrilla',
    price: 5000,
    emoji: '🍔',
    active: true,
    recipe: [
      { stockProductId: 'ing-pan', quantity: 1 },
      { stockProductId: 'ing-carne', quantity: 1 },
    ],
  },
];

const items: SalesOrderItem[] = [{ menuProductId: 'menu-1', name: 'Hamburguesa', unitPrice: 5000, quantity: 2 }];

const baseStock: StockProduct[] = [
  {
    id: 'ing-pan', name: 'Pan', code: 'I1', description: '', category: 'Insumos', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 2 }],
  },
  {
    id: 'ing-carne', name: 'Carne', code: 'I2', description: '', category: 'Insumos', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 1 }],
  },
];

describe('online/domain', () => {
  it('bloquea checkout online si falta stock', () => {
    const result = checkoutOnlineOrder(items, menu, baseStock);
    expect(result.ok).toBe(false);
    expect(result.missingSummary).toContain('ing-carne');
  });

  it('descuenta stock online cuando alcanza', () => {
    const enough = baseStock.map(product =>
      product.id === 'ing-carne'
        ? { ...product, stockByWarehouse: [{ warehouseId: 'w1', quantity: 3 }] }
        : product,
    );

    const result = checkoutOnlineOrder(items, menu, enough);
    expect(result.ok).toBe(true);
    const pan = result.updatedProducts.find(product => product.id === 'ing-pan');
    const carne = result.updatedProducts.find(product => product.id === 'ing-carne');
    expect(pan?.stockByWarehouse[0].quantity).toBe(0);
    expect(carne?.stockByWarehouse[0].quantity).toBe(1);
  });
});
