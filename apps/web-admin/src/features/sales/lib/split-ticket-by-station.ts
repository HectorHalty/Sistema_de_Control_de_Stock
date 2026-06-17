import type { PosTicket } from '@/features/sales/pos/VentasPosContext';

export type TicketPrintSplit = PosTicket & { pickupStation: string };

/** Agrupa ítems por estación de retiro; cada grupo se imprime como ticket separado. */
export function splitTicketByStation(ticket: PosTicket): TicketPrintSplit[] {
  const groups = new Map<string, PosTicket['items']>();

  for (const item of ticket.items) {
    const key = (item.station ?? '').trim();
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  return [...groups.entries()].map(([station, items]) => ({
    ...ticket,
    items,
    total: items.reduce((sum, i) => sum + i.price * i.qty, 0),
    pickupStation: station,
  }));
}

/** Estación única del ticket, si todos los ítems comparten la misma. */
export function ticketPickupStation(ticket: PosTicket): string | undefined {
  const unique = [
    ...new Set(ticket.items.map(i => (i.station ?? '').trim()).filter(Boolean)),
  ];
  return unique.length === 1 ? unique[0] : undefined;
}
