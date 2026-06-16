/**
 * Mapeo entre las formas de la API (Prisma) y las formas locales del frontend.
 *
 * Diferencias clave que esta capa concilia:
 *  - Producto: la API usa `categoryId` (UUID) + `stockLevels[]`; el front usa
 *    `category` (nombre) + `stockByWarehouse[]`.
 *  - Categoría/Almacén: la API deja `icon` opcional; el front siempre tiene uno.
 */
import type {
  StockProduct as ApiProduct,
  Warehouse as ApiWarehouse,
  Category as ApiCategory,
  ApiStockMovement,
  ApiEmployeeConsumption,
  ApiStockCountSession,
  ApiSupplier,
  ApiPurchaseOrder,
} from '@/app/api/client';
import type {
  Product, Warehouse, Category, StockMovement, EmployeeConsumptionEntry, StockCountSession,
  Supplier, Order,
} from '@/features/inventory/types';

export function mapApiProductToLocal(api: ApiProduct): Product {
  return {
    id: api.id,
    name: api.name,
    code: api.code,
    description: api.description ?? '',
    category: api.category?.name ?? '',
    unit: api.unit === 'kg' ? 'kg' : 'unidades',
    orderUnit: api.orderUnit,
    image: api.image ?? '',
    stockByWarehouse: (api.stockLevels ?? []).map(sl => ({
      warehouseId: sl.warehouseId,
      quantity: Number(sl.quantity), // Decimal llega como string por JSON
    })),
  };
}

export function mapApiWarehouseToLocal(api: ApiWarehouse): Warehouse {
  return {
    id: api.id,
    name: api.name,
    location: api.location,
    icon: api.icon ?? 'Warehouse',
  };
}

export function mapApiCategoryToLocal(api: ApiCategory): Category {
  return {
    id: api.id,
    name: api.name,
    icon: api.icon ?? 'Package',
  };
}

export function mapApiMovementToLocal(api: ApiStockMovement): StockMovement {
  return {
    id: api.id,
    createdAtISO: api.createdAt,
    type: api.type as StockMovement['type'],
    productId: api.productId,
    warehouseId: api.warehouseId ?? undefined,
    quantity: Number(api.quantity),
    reference: api.reference ?? undefined,
    operatorId: api.operatorId ?? undefined,
    operatorName: api.operatorName ?? undefined,
  };
}

export function mapApiEmployeeConsumptionToLocal(api: ApiEmployeeConsumption): EmployeeConsumptionEntry {
  return {
    id: api.id,
    date: new Date(api.createdAt).toLocaleString('es-AR'),
    day: api.day,
    createdAtISO: api.createdAt,
    productId: api.productId,
    productName: api.productName,
    productCode: api.productCode ?? '',
    warehouseId: api.warehouseId,
    warehouseName: api.warehouseName,
    quantity: Number(api.quantity),
    unit: api.unit === 'kg' ? 'kg' : 'unidades',
    previousStock: Number(api.previousStock),
    newStock: Number(api.newStock),
    operatorId: api.operatorId ?? undefined,
    operatorName: api.operatorName ?? undefined,
    operatorRole: api.operatorRole ?? undefined,
    note: api.note ?? undefined,
  };
}

export function mapApiCountSessionToLocal(api: ApiStockCountSession): StockCountSession {
  return {
    id: api.id,
    createdAtISO: api.createdAt,
    date: api.date,
    dateType: api.dateType === 'after' ? 'after' : 'regular',
    operatorId: api.operatorId ?? undefined,
    operatorName: api.operatorName ?? undefined,
    entries: api.entries.map(e => ({
      productId: e.productId,
      productName: e.productName,
      unit: e.unit === 'kg' ? 'kg' : 'unidades',
      expected: Number(e.expected),
      counted: Number(e.counted),
    })),
  };
}

export function mapApiSupplierToLocal(api: ApiSupplier): Supplier {
  return {
    id: api.id,
    name: api.name,
    productIds: (api.products ?? []).map(p => p.productId),
  };
}

export function mapApiPurchaseOrderToLocal(api: ApiPurchaseOrder): Order {
  return {
    id: api.orderNumber,
    date: api.date,
    provider: api.provider,
    status: api.status === 'Recibido' ? 'Recibido' : 'Pendiente',
    receivedAtISO: api.receivedAt ?? undefined,
    items: api.items.map(i => ({
      productId: i.productId,
      quantityOrdered: Number(i.quantityOrdered),
      quantityReceived: i.quantityReceived != null ? Number(i.quantityReceived) : undefined,
    })),
  };
}

/**
 * Próximo código de producto para una categoría, evitando colisiones con el
 * `code` único de la API. Toma el mayor sufijo numérico existente del prefijo y
 * le suma uno (en vez de contar productos, que podría repetir un código tras
 * borrados).
 */
export function nextProductCode(
  products: Pick<Product, 'category' | 'code'>[],
  categoryName: string,
  prefixFor: (category: string) => string,
  format: (prefix: string, sequence: number) => string,
): string {
  const prefix = prefixFor(categoryName);
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const p of products) {
    const m = p.code.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return format(prefix, max + 1);
}
