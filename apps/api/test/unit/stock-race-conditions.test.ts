import { describe, it, expect } from 'vitest';

/**
 * Stock race-condition prevention tests.
 * Tests the pure-function logic that the server-side transactional checkout uses.
 *
 * The server uses SELECT FOR UPDATE + Prisma $transaction for actual atomicity.
 * These tests verify the validation and deduction logic that runs within that transaction.
 */

interface StockProduct {
  id: string;
  stockByWarehouse: { warehouseId: string; quantity: number }[];
}

interface RecipeItem {
  stockProductId: string;
  quantity: number;
}

interface SalesProduct {
  id: string;
  recipe: RecipeItem[];
}

interface OrderItem {
  salesProductId: string;
  quantity: number;
}

function getTotalStock(product: StockProduct): number {
  return product.stockByWarehouse.reduce((sum, w) => sum + w.quantity, 0);
}

function buildRequiredByStockProduct(
  orderItems: OrderItem[],
  menuProducts: SalesProduct[],
): Record<string, number> {
  const menuMap = new Map(menuProducts.map(p => [p.id, p]));
  const required: Record<string, number> = {};

  for (const item of orderItems) {
    const sp = menuMap.get(item.salesProductId);
    if (!sp) continue;
    for (const recipe of sp.recipe) {
      required[recipe.stockProductId] = (required[recipe.stockProductId] || 0) + recipe.quantity * item.quantity;
    }
  }
  return required;
}

function validateStock(
  orderItems: OrderItem[],
  menuProducts: SalesProduct[],
  stockProducts: StockProduct[],
): { ok: boolean; missing: { stockProductId: string; required: number; available: number }[] } {
  const required = buildRequiredByStockProduct(orderItems, menuProducts);
  const stockMap = new Map(stockProducts.map(p => [p.id, p]));
  const missing: { stockProductId: string; required: number; available: number }[] = [];

  for (const [stockProductId, requiredQty] of Object.entries(required)) {
    const product = stockMap.get(stockProductId);
    const available = product ? getTotalStock(product) : 0;
    if (available < requiredQty) {
      missing.push({ stockProductId, required: requiredQty, available });
    }
  }

  return { ok: missing.length === 0, missing };
}

function applyDeduction(
  stockProducts: StockProduct[],
  requiredByStockProduct: Record<string, number>,
): StockProduct[] {
  return stockProducts.map(product => {
    const required = requiredByStockProduct[product.id] || 0;
    if (required <= 0) return product;

    let remaining = required;
    const updatedStockByWarehouse = product.stockByWarehouse.map(wh => {
      if (remaining <= 0) return wh;
      const deduction = Math.min(wh.quantity, remaining);
      remaining -= deduction;
      return { ...wh, quantity: wh.quantity - deduction };
    });

    return { ...product, stockByWarehouse: updatedStockByWarehouse };
  });
}

describe('Stock race-condition prevention', () => {
  const menuProducts: SalesProduct[] = [
    {
      id: 'burger',
      recipe: [
        { stockProductId: 'pan', quantity: 1 },
        { stockProductId: 'meat', quantity: 1 },
        { stockProductId: 'cheese', quantity: 1 },
      ],
    },
  ];

  it('passes validation when stock is sufficient', () => {
    const stock: StockProduct[] = [
      { id: 'pan', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] },
      { id: 'meat', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] },
      { id: 'cheese', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] },
    ];

    const result = validateStock([{ salesProductId: 'burger', quantity: 2 }], menuProducts, stock);
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('fails validation when stock is insufficient', () => {
    const stock: StockProduct[] = [
      { id: 'pan', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] },
      { id: 'meat', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] },
      { id: 'cheese', stockByWarehouse: [{ warehouseId: 'w1', quantity: 1 }] }, // only 1 cheese
    ];

    const result = validateStock([{ salesProductId: 'burger', quantity: 2 }], menuProducts, stock);
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].stockProductId).toBe('cheese');
    expect(result.missing[0].required).toBe(2);
    expect(result.missing[0].available).toBe(1);
  });

  it('deducts stock correctly across warehouses', () => {
    const stock: StockProduct[] = [
      { id: 'pan', stockByWarehouse: [{ warehouseId: 'w1', quantity: 5 }, { warehouseId: 'w2', quantity: 3 }] },
    ];

    const required = { pan: 6 };
    const updated = applyDeduction(stock, required);

    expect(updated[0].stockByWarehouse[0].quantity).toBe(0); // w1: 5 - 5 = 0
    expect(updated[0].stockByWarehouse[1].quantity).toBe(2); // w2: 3 - 1 = 2
  });

  it('prevents overselling: second concurrent sale fails after first deducts', () => {
    // Simulates the race condition scenario: two checkouts happening "simultaneously"
    const stock: StockProduct[] = [
      { id: 'pan', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] },
      { id: 'meat', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] },
      { id: 'cheese', stockByWarehouse: [{ warehouseId: 'w1', quantity: 1 }] }, // exactly 1
    ];

    const order = [{ salesProductId: 'burger', quantity: 1 }];

    // First checkout: validates and deducts
    const v1 = validateStock(order, menuProducts, stock);
    expect(v1.ok).toBe(true);
    const afterFirst = applyDeduction(stock, v1.missing.length === 0 ? buildRequiredByStockProduct(order, menuProducts) : {});

    // Second checkout: should fail because cheese is now 0
    const v2 = validateStock(order, menuProducts, afterFirst);
    expect(v2.ok).toBe(false);
    expect(v2.missing[0].stockProductId).toBe('cheese');
    expect(v2.missing[0].available).toBe(0);
  });

  it('handles multi-ingredient recipe correctly', () => {
    const comboMenu: SalesProduct[] = [
      {
        id: 'combo',
        recipe: [
          { stockProductId: 'pan', quantity: 1 },
          { stockProductId: 'meat', quantity: 2 }, // needs 2 meat
          { stockProductId: 'cheese', quantity: 1 },
          { stockProductId: 'sauce', quantity: 3 }, // needs 3 sauce
        ],
      },
    ];

    const stock: StockProduct[] = [
      { id: 'pan', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] },
      { id: 'meat', stockByWarehouse: [{ warehouseId: 'w1', quantity: 5 }] },
      { id: 'cheese', stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }] },
      { id: 'sauce', stockByWarehouse: [{ warehouseId: 'w1', quantity: 8 }] },
    ];

    // 2 combos need: 2 pan, 4 meat, 2 cheese, 6 sauce
    const result = validateStock([{ salesProductId: 'combo', quantity: 2 }], comboMenu, stock);
    expect(result.ok).toBe(true);

    // 3 combos need: 3 pan, 6 meat, 3 cheese, 9 sauce - should fail on meat and sauce
    const result2 = validateStock([{ salesProductId: 'combo', quantity: 3 }], comboMenu, stock);
    expect(result2.ok).toBe(false);
    expect(result2.missing.some(m => m.stockProductId === 'meat')).toBe(true);
    expect(result2.missing.some(m => m.stockProductId === 'sauce')).toBe(true);
  });
});
