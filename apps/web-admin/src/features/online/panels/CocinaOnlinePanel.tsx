import { useCallback, useEffect, useState } from 'react';
import { kitchenApi, salesApi, type Kitchen, type KitchenOrder } from '@/app/api/client';
import {
  NEXT_KITCHEN_STATUS,
  OnlineError,
  OnlinePanelShell,
  STATUS_LABELS,
  onlineButtonClass,
} from '../online-shared';

export function CocinaOnlinePanel() {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [kitchenId, setKitchenId] = useState('');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ks = await salesApi.kitchens.list();
      setKitchens(ks);
      const kid = kitchenId || ks[0]?.id || '';
      if (!kitchenId && kid) setKitchenId(kid);
      if (kid) {
        setOrders(await kitchenApi.orders.list(kid, undefined, true));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [kitchenId]);

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 15000);
    return () => clearInterval(t);
  }, [reload]);

  async function advance(order: KitchenOrder) {
    const next = NEXT_KITCHEN_STATUS[order.status];
    if (!next) return;
    try {
      await kitchenApi.orders.transition(order.id, next as KitchenOrder['status']);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    }
  }

  const active = orders.filter((o) => o.status !== 'delivered');

  return (
    <OnlinePanelShell title="Cocina online">
      <p className="text-sm text-muted-foreground">
        Cola de pedidos de la cantina web. Se actualiza cada 15 segundos.
      </p>
      {error && <OnlineError message={error} />}
      <select
        className="max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
        value={kitchenId}
        onChange={(e) => setKitchenId(e.target.value)}
      >
        {kitchens.map((k) => (
          <option key={k.id} value={k.id}>
            {k.emoji} {k.name}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando pedidos...</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {active.map((order) => (
            <div key={order.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold">Ticket #{order.ticketNumber}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>
              {order.pedidoPublico?.tokenRetiro?.token && (
                <p className="mb-2 font-mono text-xs text-muted-foreground">
                  QR: {order.pedidoPublico.tokenRetiro.token}
                </p>
              )}
              <ul className="mb-3 space-y-1 text-sm">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.emoji} {item.quantity}× {item.name}
                  </li>
                ))}
              </ul>
              {NEXT_KITCHEN_STATUS[order.status] && (
                <button
                  type="button"
                  className={onlineButtonClass()}
                  onClick={() => advance(order)}
                >
                  → {STATUS_LABELS[NEXT_KITCHEN_STATUS[order.status]!] ?? 'Siguiente'}
                </button>
              )}
            </div>
          ))}
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay pedidos online activos en cocina.</p>
          )}
        </div>
      )}
    </OnlinePanelShell>
  );
}
