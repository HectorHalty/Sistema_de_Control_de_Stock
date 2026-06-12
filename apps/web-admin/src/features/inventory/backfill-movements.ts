import type {
  EmployeeConsumptionEntry,
  Order,
  SalesProduct,
  SalesTicket,
  StockMovement,
} from '@/app/components/store';
import { buildRequiredStockFromCart } from '@/features/sales/stock-link';

interface BackfillSources {
  existingMovements: StockMovement[];
  employeeConsumptionLogs: EmployeeConsumptionEntry[];
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
 * (consumos de empleados, tickets de venta/devolución y pedidos recibidos).
 * Idempotente: omite cualquier documento cuya referencia ya tenga movimientos.
 */
export function buildBackfillMovements(sources: BackfillSources): StockMovement[] {
  const { existingMovements, employeeConsumptionLogs, salesTickets, salesProducts, orders } = sources;

  const referencedDocs = new Set(
    existingMovements.map(m => m.reference).filter((r): r is string => !!r),
  );

  const result: StockMovement[] = [];

  // 1) Consumos de empleados.
  for (const e of employeeConsumptionLogs) {
    if (referencedDocs.has(e.id)) continue;
    if (e.quantity <= 0) continue;
    result.push({
      id: newId(),
      createdAtISO: e.createdAtISO || dayToISO(e.day),
      type: 'consumo',
      productId: e.productId,
      warehouseId: e.warehouseId,
      quantity: -Math.abs(e.quantity),
      reference: e.id,
    });
  }

  // 2) Tickets de venta y devolución.
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
