import { describe, expect, it } from 'vitest';
import { applyStockDeduction, buildRequiredByStockProduct, validateStockForOrder } from './domain';
import type { SalesMenuProduct, SalesOrderItem, StockProduct } from './types';

const menuProducts: SalesMenuProduct[] = [
  {
    id: 'menu-burger',
    name: 'Hamburguesa Simple',
    category: 'Comidas',
    station: 'Parrilla',
    price: 3500,
    emoji: '🍔',
    active: true,
    recipe: [
      { stockProductId: 'stock-pan', quantity: 1 },
      { stockProductId: 'stock-medallon', quantity: 1 },
      { stockProductId: 'stock-queso', quantity: 1 },
    ],
  },
];

const orderItems: SalesOrderItem[] = [{ menuProductId: 'menu-burger', name: 'Hamburguesa Simple', unitPrice: 3500, quantity: 2 }];

const stockProducts: StockProduct[] = [
  {
    id: 'stock-pan',
    name: 'Pan de Hamburguesa',
    code: 'ING-001',
    description: '',
    category: 'Insumos',
    unit: 'unidades',
    image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 5 }],
  },
  {
    id: 'stock-medallon',
    name: 'Medallon de Carne',
    code: 'ING-002',
    description: '',
    category: 'Insumos',
    unit: 'unidades',
    image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 5 }],
  },
  {
    id: 'stock-queso',
    name: 'Queso Cheddar Feta',
    code: 'ING-003',
    description: '',
    category: 'Insumos',
    unit: 'unidades',
    image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 1 }],
  },
];

describe('sales/domain', () => {
  it('calcula requerimientos por receta', () => {
    const required = buildRequiredByStockProduct(orderItems, menuProducts);
    expect(required['stock-pan']).toBe(2);
    expect(required['stock-medallon']).toBe(2);
    expect(required['stock-queso']).toBe(2);
  });

  it('bloquea venta cuando no hay stock suficiente', () => {
    const validation = validateStockForOrder(orderItems, menuProducts, stockProducts);
    expect(validation.ok).toBe(false);
    expect(validation.missing).toHaveLength(1);
    expect(validation.missing[0].stockProductId).toBe('stock-queso');
  });

  it('descuenta stock correctamente cuando hay disponibilidad', () => {
    const availableStock = stockProducts.map(product =>
      product.id === 'stock-queso'
        ? { ...product, stockByWarehouse: [{ warehouseId: 'w1', quantity: 4 }] }
        : product,
    );

    const validation = validateStockForOrder(orderItems, menuProducts, availableStock);
    expect(validation.ok).toBe(true);

    const updated = applyStockDeduction(availableStock, validation.requiredByStockProduct);
    const updatedPan = updated.find(item => item.id === 'stock-pan');
    const updatedCheddar = updated.find(item => item.id === 'stock-queso');

    expect(updatedPan?.stockByWarehouse[0].quantity).toBe(3);
    expect(updatedCheddar?.stockByWarehouse[0].quantity).toBe(2);
  });
});
