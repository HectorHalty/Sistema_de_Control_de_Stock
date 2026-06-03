import type { PosTicket } from './VentasPosContext';

/** Cantidad vendida que aún puede devolverse por producto (salesProductId). */
export function getReturnableQuantities(tickets: PosTicket[]): Map<string, number> {
  const sold = new Map<string, number>();
  const returned = new Map<string, number>();

  for (const ticket of tickets) {
    if (ticket.status === 'anulado') continue;

    if (ticket.kind === 'devolucion') {
      for (const item of ticket.items) {
        returned.set(
          item.productId,
          (returned.get(item.productId) ?? 0) + item.qty,
        );
      }
      continue;
    }

    if (ticket.kind === 'venta' && ticket.status === 'emitido') {
      for (const item of ticket.items) {
        sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.qty);
      }
    }
  }

  const returnable = new Map<string, number>();
  for (const [productId, qtySold] of sold) {
    const remaining = qtySold - (returned.get(productId) ?? 0);
    if (remaining > 0) returnable.set(productId, remaining);
  }
  return returnable;
}
