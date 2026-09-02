import type { Kitchen, KitchenOrder } from '@/app/api/client';
import logo from '@/assets/baner-chacra.png';
import { NEXT_KITCHEN_STATUS, STATUS_LABELS, onlineButtonClass } from './online-shared';

function formatTicketDate(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

type Props = {
  order: KitchenOrder;
  kitchen?: Kitchen;
  highlight?: boolean;
  onAdvance?: () => void;
};

export function OnlineKitchenTicket({ order, kitchen, highlight, onAdvance }: Props) {
  const next = NEXT_KITCHEN_STATUS[order.status];
  const total =
    order.ticket?.total ??
    order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className={`mx-auto w-full max-w-[280px] bg-white font-mono text-xs text-gray-900 shadow-md ${
        highlight ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      }`}
      style={{ border: '1px dashed #ccc', padding: '12px' }}
    >
      <div className="mb-1 text-center">
        <img src={logo} alt="La Chacra Fútbol" className="mx-auto block h-10 max-w-full object-contain" />
      </div>
      <div className="text-center text-[10px] font-bold uppercase tracking-wide">
        La Chacra Fútbol
      </div>
      <div className="text-center text-[10px] text-gray-600">Cantina Online</div>
      <div className="my-2 border-t border-dashed border-gray-400" />

      <div className="flex justify-between">
        <span>Ticket Nº</span>
        <span className="font-bold">{String(order.ticketNumber).padStart(6, '0')}</span>
      </div>
      <div className="flex justify-between">
        <span>Fecha</span>
        <span>{formatTicketDate(order.ticket?.createdAt ?? order.createdAt)}</span>
      </div>
      <div className="flex justify-between">
        <span>Origen</span>
        <span className="uppercase">{order.ticket?.origen ?? 'Online'}</span>
      </div>
      <div className="flex justify-between">
        <span>Cocina</span>
        <span className="font-bold uppercase">
          {kitchen?.emoji ? `${kitchen.emoji} ` : ''}
          {kitchen?.name ?? '—'}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Estado</span>
        <span className="font-semibold">{STATUS_LABELS[order.status] ?? order.status}</span>
      </div>

      <div className="my-2 border-t border-dashed border-gray-400" />

      <div className="space-y-1">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-2">
            <span className="truncate font-bold">
              {item.emoji ? `${item.emoji} ` : ''}
              {item.quantity}× {item.name}
            </span>
          </div>
        ))}
      </div>

      {order.ticket?.total != null && (
        <>
          <div className="my-2 border-t border-dashed border-gray-400" />
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>${Number(order.ticket.total).toLocaleString('es-AR')}</span>
          </div>
        </>
      )}

      {order.pedidoPublico?.tokenRetiro?.token && (
        <div className="mt-2 text-center text-[10px] text-gray-500">
          QR: {order.pedidoPublico.tokenRetiro.token}
        </div>
      )}

      <div className="mt-2 border-t border-dashed border-gray-400 pt-2 text-center text-[10px] text-gray-500">
        Presentar en retiro · {typeof total === 'number' && order.ticket?.total == null ? `${order.items.length} ítems` : 'Gracias'}
      </div>

      {next && onAdvance && (
        <button type="button" className={`${onlineButtonClass()} mt-3 w-full`} onClick={onAdvance}>
          → {STATUS_LABELS[next] ?? 'Siguiente'}
        </button>
      )}
    </div>
  );
}

export function aggregatePendingItems(orders: KitchenOrder[]) {
  const map = new Map<string, { name: string; emoji?: string; quantity: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.salesProductId || item.name;
      const row = map.get(key);
      if (row) row.quantity += item.quantity;
      else map.set(key, { name: item.name, emoji: item.emoji, quantity: item.quantity });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
