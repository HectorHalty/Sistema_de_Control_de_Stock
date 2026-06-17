import type { SalesHistoryEntry, SalesTicket } from './types';

/** Deriva entradas de historial de ventas desde tickets del servidor. */
export function historyFromTickets(tickets: SalesTicket[]): SalesHistoryEntry[] {
  return tickets.map(t => {
    const type: SalesHistoryEntry['type'] =
      t.status === 'anulado' ? 'anulacion' : t.status === 'devuelto' ? 'devolucion' : 'venta';
    const detail =
      type === 'anulacion'
        ? `Anulacion ticket #${t.number}`
        : type === 'devolucion'
          ? `Devolucion #${t.number}`
          : `Venta #${t.number}`;
    return {
      id: `h-${t.id}`,
      timestampISO: t.createdAtISO,
      operatorId: t.operatorId,
      operatorName: t.operatorName,
      type,
      detail,
      ticketId: t.id,
    };
  });
}

const LOCAL_ONLY_HISTORY_TYPES = new Set<SalesHistoryEntry['type']>([
  'producto_creado',
  'producto_editado',
  'receta_creada',
  'receta_editada',
  'mesa_creada',
  'mesa_editada',
]);

/** Combina historial del servidor con entradas locales (config de productos/mesas). */
export function mergeSalesHistory(
  fromTickets: SalesHistoryEntry[],
  existing: SalesHistoryEntry[],
): SalesHistoryEntry[] {
  const localOnly = existing.filter(e => LOCAL_ONLY_HISTORY_TYPES.has(e.type));
  return [...fromTickets, ...localOnly].sort(
    (a, b) => new Date(b.timestampISO).getTime() - new Date(a.timestampISO).getTime(),
  );
}

/**
 * Fusiona tickets del servidor con el estado local.
 * El servidor gana en IDs compartidos; se conservan tickets locales aún no replicados
 * (evita que una hidratación en vuelo borre una venta recién confirmada).
 */
export function mergeTicketsFromServer(
  fromServer: SalesTicket[],
  existing: SalesTicket[],
): SalesTicket[] {
  const byId = new Map(fromServer.map(t => [t.id, t]));
  for (const t of existing) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime(),
  );
}
