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
} from '@/app/api/client';
import type { Product, Warehouse, Category } from '@/features/inventory/types';

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
      quantity: sl.quantity,
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
