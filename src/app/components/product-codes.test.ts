import { describe, expect, it } from 'vitest';
import type { Product } from './store';
import {
  formatProductCode,
  getCategoryCodePrefix,
  previewNextProductCode,
  reassignProductCodes,
} from './product-codes';

const base = (overrides: Partial<Product> & Pick<Product, 'id' | 'category'>): Product => ({
  name: 'Test',
  code: '',
  description: '',
  unit: 'unidades',
  image: '',
  stockByWarehouse: [],
  ...overrides,
});

describe('product-codes', () => {
  it('uses known category prefixes', () => {
    expect(getCategoryCodePrefix('Bebidas')).toBe('BEB');
    expect(formatProductCode('BEB', 1)).toBe('BEB-001');
  });

  it('reassigns sequential codes per category', () => {
    const products = [
      base({ id: 'p1', category: 'Bebidas' }),
      base({ id: 'p2', category: 'Snacks' }),
      base({ id: 'p3', category: 'Bebidas' }),
    ];
    const result = reassignProductCodes(products);
    expect(result.map(p => p.code)).toEqual(['BEB-001', 'SNK-001', 'BEB-002']);
  });

  it('closes gaps after delete', () => {
    const products = [
      base({ id: 'p1', category: 'Bebidas', code: 'BEB-001' }),
      base({ id: 'p3', category: 'Bebidas', code: 'BEB-003' }),
    ];
    const result = reassignProductCodes(products);
    expect(result.map(p => p.code)).toEqual(['BEB-001', 'BEB-002']);
  });

  it('previews next code excluding current product when editing', () => {
    const products = [
      base({ id: 'p1', category: 'Bebidas', code: 'BEB-001' }),
      base({ id: 'p2', category: 'Bebidas', code: 'BEB-002' }),
    ];
    expect(previewNextProductCode(products, 'Bebidas', 'p2')).toBe('BEB-002');
    expect(previewNextProductCode(products, 'Snacks')).toBe('SNK-001');
  });
});
