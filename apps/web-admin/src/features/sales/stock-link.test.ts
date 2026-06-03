import { describe, expect, it } from 'vitest';
import type { Product, SalesProduct } from '@/app/components/store';
import { getMaxSellableUnits, isSalesProductAvailable, deductStockForSale } from './stock-link';

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
  active: true,
  recipe: [
    { stockProductId: 'p1', quantity: 2 },
    { stockProductId: 'p2', quantity: 1 },
  ],
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
});
