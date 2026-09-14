import type {
  Order,
  SalesProduct,
  SalesTicket,
  StockMovement,
} from '@/app/components/store';
import { buildRequiredStockFromCart } from '@/features/sales/stock-link';

interface BackfillSources {
  existingMovements: StockMovement[];
  salesTickets: SalesTicket[];
  salesProducts: SalesProduct[];
  orders: Order[];
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `mov-bf-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

function dayToISO(day: string): string {
  // "YYYY-MM-DD" → ISO al mediodía para evitar saltos de huso.
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Date(`${day}T12:00:00`).toISOString();
  const d = new Date(day);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Reconstruye el libro de movimientos a partir del historial ya existente
 * (tickets de venta/consumo/devolución y pedidos recibidos). Idempotente:
 * omite cualquier documento cuya referencia ya tenga movimientos.
 *
 * El backfill de consumos de empleados (viejo modelo de insumo suelto, sin
 * receta) se retiró junto con `ConsumoEmpleado` — ver
 * docs/superpowers/plans/2026-09-08-consumo-como-venta.md. Un consumo hoy
 * es un `TicketVenta` más (origen 'consumo'), así que ya lo cubre el punto
 * 1 de acá abajo igual que cualquier venta.
 */
export function buildBackfillMovements(sources: BackfillSources): StockMovement[] {
  const { existingMovements, salesTickets, salesProducts, orders } = sources;

  const referencedDocs = new Set(
    existingMovements.map(m => m.reference).filter((r): r is string => !!r),
  );

  const result: StockMovement[] = [];

  // 1) Tickets de venta, consumo y devolución.
  for (const ticket of salesTickets) {
    if (referencedDocs.has(ticket.id)) continue;
    // Los anulados tienen efecto neto cero sobre el stock; se omiten.
    if (ticket.status === 'anulado') continue;

    const required = buildRequiredStockFromCart(
      ticket.items.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
      salesProducts,
    );
    const isReturn = ticket.status === 'devuelto';
    for (const [productId, qty] of Object.entries(required)) {
      if (qty <= 0) continue;
      result.push({
        id: newId(),
        createdAtISO: ticket.createdAtISO,
        type: isReturn ? 'devolucion' : 'venta',
        productId,
        quantity: isReturn ? Math.abs(qty) : -Math.abs(qty),
        reference: ticket.id,
        operatorId: ticket.operatorId,
        operatorName: ticket.operatorName,
      });
    }
  }

  // 3) Pedidos recibidos (entradas).
  for (const order of orders) {
    if (order.status !== 'Recibido') continue;
    if (referencedDocs.has(order.id)) continue;
    const createdAtISO = order.receivedAtISO || dayToISO(order.date);
    for (const item of order.items) {
      const qty = item.quantityReceived ?? item.quantityOrdered;
      if (!qty || qty <= 0) continue;
      result.push({
        id: newId(),
        createdAtISO,
        type: 'entrada',
        productId: item.productId,
        quantity: Math.abs(qty),
        reference: order.id,
      });
    }
  }

  return result;
}
