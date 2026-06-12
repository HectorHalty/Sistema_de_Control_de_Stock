import type { Order } from './types';

/** Ordena pedidos por fecha descendente (el más cercano a hoy primero). */
export function sortOrdersByDateDesc(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => b.date.localeCompare(a.date));
}

/** Migra el estado legacy "Confirmado" a "Recibido". */
export function migrateOrderStatuses(orders: Order[]): Order[] {
  return orders.map(order =>
    (order.status as string) === 'Confirmado' ? { ...order, status: 'Recibido' } : order,
  );
}

export function isOrderReceived(status: string): boolean {
  return status === 'Recibido' || status === 'Confirmado';
}
