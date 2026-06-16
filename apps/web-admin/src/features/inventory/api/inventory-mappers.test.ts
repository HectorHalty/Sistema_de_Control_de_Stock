import { describe, expect, it } from 'vitest';
import type { StockProduct, Warehouse, Category } from '@/app/api/client';
import {
  mapApiProductToLocal,
  mapApiWarehouseToLocal,
  mapApiCategoryToLocal,
  nextProductCode,
} from '@/features/inventory/api/inventory-mappers';
import { formatProductCode, getCategoryCodePrefix } from '@/features/inventory/product-codes';

describe('mapApiProductToLocal', () => {
  it('mapea categoryId/stockLevels al formato local (nombre + stockByWarehouse)', () => {
    const api: StockProduct = {
      id: 'uuid-1',
      name: 'Coca 500ml',
      code: 'BEB-001',
      description: undefined,
      categoryId: 'cat-uuid',
      unit: 'unidades',
      orderUnit: 6,
      image: undefined,
      category: { id: 'cat-uuid', name: 'Bebidas', icon: 'Wine' },
      stockLevels: [
        { id: 'sl1', productId: 'uuid-1', warehouseId: 'w1', quantity: 10 },
        { id: 'sl2', productId: 'uuid-1', warehouseId: 'w2', quantity: 4 },
      ],
    };

    const local = mapApiProductToLocal(api);

    expect(local).toEqual({
      id: 'uuid-1',
      name: 'Coca 500ml',
      code: 'BEB-001',
      description: '',
      category: 'Bebidas',
      unit: 'unidades',
      orderUnit: 6,
      image: '',
      stockByWarehouse: [
        { warehouseId: 'w1', quantity: 10 },
        { warehouseId: 'w2', quantity: 4 },
      ],
    });
  });

  it('normaliza unit desconocido a "unidades" y stockLevels ausente a []', () => {
    const api = {
      id: 'uuid-2',
      name: 'Sin stock',
      code: 'X-1',
      categoryId: 'c',
      unit: 'litros',
    } as unknown as StockProduct;

    const local = mapApiProductToLocal(api);
    expect(local.unit).toBe('unidades');
    expect(local.stockByWarehouse).toEqual([]);
    expect(local.category).toBe('');
  });

  it('respeta unit "kg"', () => {
    const api = { id: 'a', name: 'Carne', code: 'CAR-1', categoryId: 'c', unit: 'kg' } as unknown as StockProduct;
    expect(mapApiProductToLocal(api).unit).toBe('kg');
  });
});

describe('mapApiWarehouseToLocal / mapApiCategoryToLocal', () => {
  it('aplica íconos por defecto cuando faltan', () => {
    const wh = { id: 'w', name: 'Depósito', location: 'Planta baja' } as Warehouse;
    expect(mapApiWarehouseToLocal(wh)).toEqual({
      id: 'w',
      name: 'Depósito',
      location: 'Planta baja',
      icon: 'Warehouse',
    });

    const cat = { id: 'c', name: 'Bebidas' } as Category;
    expect(mapApiCategoryToLocal(cat)).toEqual({ id: 'c', name: 'Bebidas', icon: 'Package' });
  });
});

describe('nextProductCode', () => {
  const products = [
    { category: 'Bebidas', code: 'BEB-001' },
    { category: 'Bebidas', code: 'BEB-003' },
    { category: 'Snacks', code: 'SNK-001' },
  ];

  it('usa el mayor sufijo + 1 para evitar colisiones tras borrados', () => {
    expect(nextProductCode(products, 'Bebidas', getCategoryCodePrefix, formatProductCode)).toBe('BEB-004');
  });

  it('arranca en 001 para una categoría nueva', () => {
    expect(nextProductCode(products, 'Carnes', getCategoryCodePrefix, formatProductCode)).toBe('CAR-001');
  });
});
