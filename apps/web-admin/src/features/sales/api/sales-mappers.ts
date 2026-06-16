/**
 * Mapeo entre las formas de la API (Prisma) y las formas locales del frontend
 * para el catálogo de ventas (productos de venta + recetas y cocinas).
 */
import type {
  SalesProduct as ApiSalesProduct,
  Kitchen as ApiKitchen,
} from '@/app/api/client';
import type { SalesProduct, Kitchen } from '@/features/sales/types';

export function mapApiSalesProductToLocal(api: ApiSalesProduct): SalesProduct {
  return {
    id: api.id,
    name: api.name,
    category: api.category,
    kitchenId: api.kitchenId,
    price: Number(api.price),
    emoji: api.emoji ?? '',
    active: api.active,
    recipe: (api.recipe ?? []).map(r => ({
      stockProductId: r.stockProductId,
      quantity: r.quantity,
    })),
  };
}

export function mapApiKitchenToLocal(api: ApiKitchen): Kitchen {
  return {
    id: api.id,
    name: api.name,
    emoji: api.emoji ?? '🍽️',
    active: api.active,
  };
}
