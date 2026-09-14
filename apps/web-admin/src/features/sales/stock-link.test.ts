import { describe, expect, it } from 'vitest';
import type { Product, SalesProduct } from '@/app/components/store';
import {
  getMaxSellableUnits,
  isSalesProductAvailable,
  deductStockForSale,
  computeSellableStock,
  allocateStockForCart,
  applyStockAllocations,
  restoreStockForTicket,
} from './stock-link';

const stockProducts: Product[] = [
  {
    id: 'p1',
    name: 'Coca',
    code: 'C1',
    description: '',
    category: 'Bebidas',
    unit: 'unidades',
    image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 5 }],
  },
  {
    id: 'p2',
    name: 'Pan',
    code: 'P1',
    description: '',
    category: 'Comidas',
    unit: 'unidades',
    image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 2 }],
  },
];

const combo: SalesProduct = {
  id: 'sp-combo',
  name: 'Combo',
  category: 'Promos',
  kitchenId: 'k1',
  price: 1000,
  emoji: '🎯',
  kind: 'simple',
  active: true,
  recipe: [
    { stockProductId: 'p1', quantity: 2 },
    { stockProductId: 'p2', quantity: 1 },
  ],
  bundle: [],
};

const vasoFernet: SalesProduct = {
  id: 'sp-vaso',
  name: 'Vaso Fernet',
  category: 'Bebidas',
  kitchenId: 'k1',
  price: 500,
  emoji: '🥃',
  kind: 'simple',
  active: true,
  recipe: [{ stockProductId: 'p1', quantity: 1 }],
  bundle: [],
};

const promoFernet: SalesProduct = {
  id: 'sp-promo',
  name: 'Promo 2 Fernet',
  category: 'Promos',
  kitchenId: 'k1',
  price: 900,
  emoji: '🎉',
  kind: 'promo',
  active: true,
  recipe: [],
  bundle: [{ salesProductId: 'sp-vaso', quantity: 2 }],
};

describe('stock-link', () => {
  it('hides products without recipe or stock', () => {
    expect(isSalesProductAvailable({ ...combo, recipe: [] }, stockProducts)).toBe(false);
    expect(getMaxSellableUnits(combo, stockProducts)).toBe(2);
    expect(isSalesProductAvailable(combo, stockProducts)).toBe(true);
  });

  it('deducts stock when a sale is confirmed', () => {
    const updated = deductStockForSale(stockProducts, [{ salesProductId: 'sp-combo', quantity: 1 }], [combo]);
    const coca = updated.find(p => p.id === 'p1');
    const pan = updated.find(p => p.id === 'p2');
    expect(coca?.stockByWarehouse[0].quantity).toBe(3);
    expect(pan?.stockByWarehouse[0].quantity).toBe(1);
  });

  it('computes sellable units with fractional recipe (e.g. 1 lt → 10 vasos at 0,1)', () => {
    const sellable = computeSellableStock(
      [{ stockProductId: 'p1', quantity: 0.1 }],
      () => 1,
    );
    expect(sellable).toBe(10);
  });

  it('expands promo components for stock and sellable units', () => {
    const catalog = [vasoFernet, promoFernet];
    expect(getMaxSellableUnits(promoFernet, stockProducts, catalog)).toBe(2);
    const updated = deductStockForSale(
      stockProducts,
      [{ salesProductId: 'sp-promo', quantity: 1 }],
      catalog,
    );
    expect(updated.find(p => p.id === 'p1')?.stockByWarehouse[0].quantity).toBe(3);
  });

  it('expands nested promos the same way as the API', () => {
    const megaPromo: SalesProduct = {
      ...promoFernet,
      id: 'sp-mega',
      name: 'Mega 2 promos',
      bundle: [{ salesProductId: 'sp-promo', quantity: 2 }],
    };
    const catalog = [vasoFernet, promoFernet, megaPromo];
    expect(getMaxSellableUnits(megaPromo, stockProducts, catalog)).toBe(1);
    const updated = deductStockForSale(
      stockProducts,
      [{ salesProductId: 'sp-mega', quantity: 1 }],
      catalog,
    );
    expect(updated.find(p => p.id === 'p1')?.stockByWarehouse[0].quantity).toBe(1);
  });

  it('restores the same warehouses as the sale snapshot', () => {
    const twoWh: Product[] = [
      {
        ...stockProducts[0],
        stockByWarehouse: [
          { warehouseId: 'w1', quantity: 5 },
          { warehouseId: 'w2', quantity: 3 },
        ],
      },
    ];
    const allocs = allocateStockForCart(
      [{ salesProductId: 'sp-vaso', quantity: 6 }],
      [vasoFernet],
      twoWh,
    );
    expect(allocs).toEqual([
      { stockProductId: 'p1', warehouseId: 'w1', quantity: 5 },
      { stockProductId: 'p1', warehouseId: 'w2', quantity: 1 },
    ]);
    const afterSale = applyStockAllocations(twoWh, allocs, -1);
    expect(afterSale[0].stockByWarehouse.find(w => w.warehouseId === 'w1')?.quantity).toBe(0);
    expect(afterSale[0].stockByWarehouse.find(w => w.warehouseId === 'w2')?.quantity).toBe(2);

    const restored = restoreStockForTicket(
      afterSale,
      {
        id: 't1',
        number: 1,
        createdAtISO: new Date().toISOString(),
        status: 'emitido',
        items: [{ salesProductId: 'sp-vaso', name: 'Vaso', unitPrice: 500, quantity: 6, kitchenId: 'k1' }],
        total: 3000,
        operatorId: 'op',
        operatorName: 'Op',
        stockAllocations: allocs,
      },
      [vasoFernet],
    );
    expect(restored[0].stockByWarehouse.find(w => w.warehouseId === 'w1')?.quantity).toBe(5);
    expect(restored[0].stockByWarehouse.find(w => w.warehouseId === 'w2')?.quantity).toBe(3);
  });
});
