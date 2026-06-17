import { describe, expect, it } from 'vitest';
import type { Product, SalesProduct } from '@/app/components/store';
import { getMaxSellableUnits, isSalesProductAvailable, deductStockForSale, computeSellableStock } from './stock-link';

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
});
