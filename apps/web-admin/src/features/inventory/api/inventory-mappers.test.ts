import { describe, expect, it } from 'vitest';
import type { StockProduct, Warehouse, Category } from '@/app/api/client';
import {
  mapApiProductToLocal,
  mapApiWarehouseToLocal,
  mapApiCategoryToLocal,
  mapApiSupplierToLocal,
  mapApiPurchaseOrderToLocal,
  mapApiEmployeeConsumptionToLocal,
  mapApiCountSessionToLocal,
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

  it('conserva unit "litros" y normaliza stockLevels ausente a []', () => {
    const api = {
      id: 'uuid-2',
      name: 'Sin stock',
      code: 'X-1',
      categoryId: 'c',
      unit: 'litros',
    } as unknown as StockProduct;

    const local = mapApiProductToLocal(api);
    expect(local.unit).toBe('litros');
    expect(local.stockByWarehouse).toEqual([]);
    expect(local.category).toBe('');
  });

  it('conserva unit "cajas"', () => {
    const api = { id: 'b', name: 'Gaseosa', code: 'GAS-1', categoryId: 'c', unit: 'cajas' } as unknown as StockProduct;
    expect(mapApiProductToLocal(api).unit).toBe('cajas');
  });

  it('respeta unit "kg"', () => {
    const api = { id: 'a', name: 'Carne', code: 'CAR-1', categoryId: 'c', unit: 'kg' } as unknown as StockProduct;
    expect(mapApiProductToLocal(api).unit).toBe('kg');
  });
});

describe('unidades en consumos y conteos', () => {
  function consumption(unit: string) {
    return {
      id: 'c1',
      createdAt: '2026-06-16T12:00:00Z',
      day: 'lunes',
      productId: 'p1',
      productName: 'Aceite',
      warehouseId: 'w1',
      warehouseName: 'Depósito',
      quantity: 2,
      unit,
      previousStock: 10,
      newStock: 8,
    } as unknown as Parameters<typeof mapApiEmployeeConsumptionToLocal>[0];
  }

  it.each(['unidades', 'kg', 'litros', 'cajas'])(
    'el consumo de empleado conserva la unidad %s',
    unit => {
      expect(mapApiEmployeeConsumptionToLocal(consumption(unit)).unit).toBe(unit);
    },
  );

  function countSession(unit: string) {
    return {
      id: 's1',
      createdAt: '2026-06-16T12:00:00Z',
      date: '2026-06-16',
      dateType: 'regular',
      entries: [{ productId: 'p1', productName: 'Aceite', unit, expected: 10, counted: 9 }],
    } as unknown as Parameters<typeof mapApiCountSessionToLocal>[0];
  }

  it.each(['unidades', 'kg', 'litros', 'cajas'])(
    'la entrada de conteo conserva la unidad %s',
    unit => {
      expect(mapApiCountSessionToLocal(countSession(unit)).entries[0].unit).toBe(unit);
    },
  );
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

  it('conserva el icono persistido del almacén', () => {
    const wh = { id: 'w', name: 'Heladera', location: 'Bar', icon: 'Refrigerator' } as Warehouse;
    expect(mapApiWarehouseToLocal(wh).icon).toBe('Refrigerator');
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

describe('mapApiSupplierToLocal / mapApiPurchaseOrderToLocal', () => {
  it('mapea proveedor con productIds', () => {
    expect(mapApiSupplierToLocal({
      id: 'sup-1',
      name: 'Distribuidora Norte',
      products: [{ id: 'sp1', supplierId: 'sup-1', productId: 'p1' }],
    })).toEqual({
      id: 'sup-1',
      name: 'Distribuidora Norte',
      productIds: ['p1'],
    });
  });

  it('mapea pedido usando orderNumber como id local', () => {
    expect(mapApiPurchaseOrderToLocal({
      id: 'uuid-order',
      orderNumber: 'PED-001',
      date: '2026-06-16',
      provider: 'Proveedor X',
      status: 'Pendiente',
      createdAt: '2026-06-16T12:00:00Z',
      items: [{ id: 'i1', purchaseOrderId: 'uuid-order', productId: 'p1', quantityOrdered: 10 }],
    })).toEqual({
      id: 'PED-001',
      date: '2026-06-16',
      provider: 'Proveedor X',
      status: 'Pendiente',
      items: [{ productId: 'p1', quantityOrdered: 10, quantityReceived: undefined }],
    });
  });
});
