import { describe, it, expect } from 'vitest';
import { ConflictException } from '@nestjs/common';
import {
  allocateDeduction,
  invertSaleMovements,
  scaleAllocations,
  mergeAllocations,
  parseStockAllocations,
  splitAllocationsToItems,
  assertSimpleProductsHaveRecipes,
  buildRequiredByStockProduct,
  type SalesProductForStock,
} from '../../src/sales/sales-stock';

describe('allocateDeduction', () => {
  it('reparte greedy entre almacenes en el orden dado', () => {
    const { allocations, missing } = allocateDeduction(
      [
        { productId: 'pan', warehouseId: 'w1', quantity: 5 },
        { productId: 'pan', warehouseId: 'w2', quantity: 3 },
      ],
      { pan: 6 },
    );
    expect(missing).toHaveLength(0);
    expect(allocations).toEqual([
      { stockProductId: 'pan', warehouseId: 'w1', quantity: 5 },
      { stockProductId: 'pan', warehouseId: 'w2', quantity: 1 },
    ]);
  });

  it('reporta faltante sin allocaciones si no alcanza', () => {
    const { allocations, missing } = allocateDeduction(
      [{ productId: 'pan', warehouseId: 'w1', quantity: 2 }],
      { pan: 6 },
    );
    expect(allocations).toHaveLength(0);
    expect(missing).toEqual([{ stockProductId: 'pan', required: 6, available: 2 }]);
  });
});

describe('invertSaleMovements / scaleAllocations', () => {
  it('invierte movimientos de venta negativos al mismo almacén', () => {
    const restored = invertSaleMovements([
      { productId: 'pan', warehouseId: 'w1', quantity: -5 },
      { productId: 'pan', warehouseId: 'w2', quantity: -1 },
    ]);
    expect(restored).toEqual([
      { stockProductId: 'pan', warehouseId: 'w1', quantity: 5 },
      { stockProductId: 'pan', warehouseId: 'w2', quantity: 1 },
    ]);
  });

  it('escala allocaciones para una devolución parcial', () => {
    const scaled = scaleAllocations(
      [
        { stockProductId: 'pan', warehouseId: 'w1', quantity: 5 },
        { stockProductId: 'pan', warehouseId: 'w2', quantity: 5 },
      ],
      0.4,
    );
    expect(scaled).toEqual([
      { stockProductId: 'pan', warehouseId: 'w1', quantity: 2 },
      { stockProductId: 'pan', warehouseId: 'w2', quantity: 2 },
    ]);
  });

  it('merge suma el mismo par producto-almacén', () => {
    expect(
      mergeAllocations([
        { stockProductId: 'pan', warehouseId: 'w1', quantity: 2 },
        { stockProductId: 'pan', warehouseId: 'w1', quantity: 3 },
      ]),
    ).toEqual([{ stockProductId: 'pan', warehouseId: 'w1', quantity: 5 }]);
  });
});

describe('parseStockAllocations', () => {
  it('ignora filas inválidas y normaliza cantidades', () => {
    expect(
      parseStockAllocations([
        { stockProductId: 'pan', warehouseId: 'w1', quantity: -4 },
        { stockProductId: '', warehouseId: 'w1', quantity: 1 },
        null,
      ]),
    ).toEqual([{ stockProductId: 'pan', warehouseId: 'w1', quantity: 4 }]);
  });
});

describe('splitAllocationsToItems', () => {
  it('reparte el snapshot de carrito a cada línea', () => {
    const vaso: SalesProductForStock = {
      id: 'vaso',
      kind: 'simple',
      recipe: [{ stockProductId: 'pan', quantity: 1 as unknown as SalesProductForStock['recipe'][number]['quantity'] }],
      bundleItems: [],
    };
    const spMap = new Map<string, SalesProductForStock>([['vaso', vaso]]);
    const items = [
      { salesProductId: 'vaso', quantity: 2 },
      { salesProductId: 'vaso', quantity: 1 },
    ];
    const required = buildRequiredByStockProduct(items, spMap);
    expect(required).toEqual({ pan: 3 });
    const { allocations } = allocateDeduction(
      [
        { productId: 'pan', warehouseId: 'w1', quantity: 2 },
        { productId: 'pan', warehouseId: 'w2', quantity: 5 },
      ],
      required,
    );
    const perItem = splitAllocationsToItems(items, spMap, allocations);
    const sumQty = perItem.flat().reduce((s, a) => s + a.quantity, 0);
    expect(sumQty).toBe(3);
    expect(perItem[0].reduce((s, a) => s + a.quantity, 0)).toBe(2);
    expect(perItem[1].reduce((s, a) => s + a.quantity, 0)).toBe(1);
  });
});

describe('assertSimpleProductsHaveRecipes', () => {
  it('rechaza un simple sin receta', () => {
    const spMap = new Map<string, SalesProductForStock>([
      ['x', { id: 'x', kind: 'simple', recipe: [], bundleItems: [] }],
    ]);
    expect(() => assertSimpleProductsHaveRecipes([{ salesProductId: 'x' }], spMap)).toThrow(
      ConflictException,
    );
  });
});
