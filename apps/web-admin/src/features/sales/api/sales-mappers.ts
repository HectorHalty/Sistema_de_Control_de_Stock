/**
 * Mapeo entre las formas de la API (Prisma) y las formas locales del frontend
 * para el catálogo de ventas (productos de venta + recetas y cocinas).
 */
import type {
  SalesProduct as ApiSalesProduct,
  Kitchen as ApiKitchen,
  SalesTicket as ApiSalesTicket,
} from '@/app/api/client';
import type { SalesProduct, Kitchen, SalesTicket } from '@/features/sales/types';

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
      quantity: Number(r.quantity), // Decimal llega como string por JSON
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

/**
 * Mapea un ticket de la API al ticket local del POS.
 * - `operatorName` se resuelve desde `operator.username` (listado) y, si no
 *   viene (ej. respuesta de checkout sin relación operator), usa el fallback.
 * - `unitPrice`/`total` son Decimal y llegan como string por JSON.
 * - `kitchenId` por ítem no viene en la API: se enriquece desde el catálogo de
 *   productos de venta para el agrupado por cocina en dashboards.
 */
export function mapApiTicketToLocal(
  api: ApiSalesTicket,
  salesProducts: SalesProduct[],
  operatorNameFallback = '',
): SalesTicket {
  const createdAtISO =
    typeof api.createdAt === 'string'
      ? api.createdAt.includes('T')
        ? api.createdAt
        : new Date(api.createdAt).toISOString()
      : new Date().toISOString();

  const status: SalesTicket['status'] =
    api.status === 'anulado' || api.status === 'devuelto' || api.status === 'emitido'
      ? api.status
      : 'emitido';

  return {
    id: api.id,
    number: api.number,
    createdAtISO,
    status,
    items: api.items.map(i => ({
      salesProductId: i.salesProductId,
      name: i.name,
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
      kitchenId: salesProducts.find(sp => sp.id === i.salesProductId)?.kitchenId || '',
    })),
    total: Number(api.total),
    operatorId: api.operatorId,
    operatorName: api.operator?.username || operatorNameFallback,
    note: api.note,
  };
}
