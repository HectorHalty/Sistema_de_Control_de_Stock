import { useCallback, useEffect, useMemo, useState } from 'react';
import { QrCode } from 'lucide-react';
import {
  kitchenApi,
  onlineApi,
  getAccessToken,
  type Kitchen,
  type KitchenOrder,
  type RedeemQrResponse,
} from '@/app/api/client';
import { QrScanOverlay } from '../QrScanOverlay';
import { OnlineKitchenTicket, aggregatePendingItems } from '../OnlineKitchenTicket';
import {
  NEXT_KITCHEN_STATUS,
  OnlineError,
  OnlinePanelShell,
  STATUS_LABELS,
  onlineButtonClass,
  onlineFieldClass,
} from '../online-shared';

export function CocinaOnlinePanel() {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [kitchenId, setKitchenId] = useState('');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemed, setRedeemed] = useState<RedeemQrResponse['pedido'] | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) return;
      const ks = await onlineApi.kitchens.list(token);
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

  const activeKitchen = kitchens.find((k) => k.id === kitchenId);
  const active = orders.filter((o) => o.status !== 'delivered');
  const oldest = active[0] ?? null;
  const pendingItems = useMemo(() => aggregatePendingItems(active), [active]);
  const otherOrders = oldest ? active.slice(1) : active;

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

  async function handleScan(token: string) {
    const authToken = getAccessToken();
    if (!authToken) return;
    setRedeemLoading(true);
    setError(null);
    try {
      const res = await onlineApi.redeemQr(token, authToken);
      setScanOpen(false);
      setRedeemed(res.pedido);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo validar el código');
    } finally {
      setRedeemLoading(false);
    }
  }

  return (
    <>
      <OnlinePanelShell title="Cocina online">
        <div className="sticky top-0 z-10 -mx-1 space-y-3 rounded-xl border border-border bg-background/95 p-3 backdrop-blur">
          <p className="text-sm text-muted-foreground">
            Pedidos online por cocina. El ticket más antiguo pendiente aparece listo para preparar.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cocina
            </label>
            <select
              className={`${onlineFieldClass()} max-w-md font-medium`}
              value={kitchenId}
              onChange={(e) => setKitchenId(e.target.value)}
            >
              {kitchens.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.emoji} {k.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <OnlineError message={error} />}

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando pedidos...</p>
        ) : active.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            No hay pedidos online pendientes en {activeKitchen?.name ?? 'esta cocina'}.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Productos pendientes · {activeKitchen?.name}
              </h3>
              <ul className="space-y-2">
                {pendingItems.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {item.emoji ? `${item.emoji} ` : ''}
                      {item.name}
                    </span>
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-black text-primary">
                      {item.quantity} u.
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {active.length} pedido(s) activo(s) en cola
              </p>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Pedido más antiguo
                </h3>
                {oldest && (
                  <OnlineKitchenTicket
                    order={oldest}
                    kitchen={activeKitchen}
                    highlight
                    onAdvance={() => advance(oldest)}
                  />
                )}
              </div>

              {otherOrders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    En cola
                  </h3>
                  {otherOrders.map((order) => (
                    <div key={order.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-bold">#{String(order.ticketNumber).padStart(6, '0')}</span>
                        <span className="text-xs text-muted-foreground">
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </div>
                      <ul className="mb-2 space-y-0.5 text-xs text-muted-foreground">
                        {order.items.map((item) => (
                          <li key={item.id}>
                            {item.quantity}× {item.name}
                          </li>
                        ))}
                      </ul>
                      {NEXT_KITCHEN_STATUS[order.status] && (
                        <button
                          type="button"
                          className={`${onlineButtonClass('ghost')} w-full text-xs`}
                          onClick={() => advance(order)}
                        >
                          → {STATUS_LABELS[NEXT_KITCHEN_STATUS[order.status]!] ?? 'Siguiente'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </OnlinePanelShell>

      <button
        type="button"
        onClick={() => setScanOpen(true)}
        aria-label="Escanear QR"
        className="fixed bottom-8 left-1/2 z-40 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition hover:scale-105 active:scale-95"
      >
        <QrCode size={36} strokeWidth={2.2} />
      </button>

      <QrScanOverlay
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
        loading={redeemLoading}
      />

      {redeemed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-primary/40 bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 text-xl font-bold text-primary">
              <QrCode size={24} />
              Pedido entregado
            </div>
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Nº pedido:</span>{' '}
                <strong className="text-lg">#{redeemed.ticketNumber ?? '—'}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Cliente:</span>{' '}
                <strong>{redeemed.customerName}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Retiro en:</span>{' '}
                <strong>
                  {redeemed.kitchens.map((k) => `${k.emoji ?? ''} ${k.name}`.trim()).join(' · ') ||
                    redeemed.pickupKitchen ||
                    '—'}
                </strong>
              </p>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="mb-2 font-semibold">Productos</p>
                <ul className="space-y-1">
                  {redeemed.items.map((item, i) => (
                    <li key={i}>
                      {item.emoji} {item.quantity}× {item.name}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-muted-foreground">
                Total: ${redeemed.total.toLocaleString('es-AR')}
              </p>
            </div>
            <button
              type="button"
              className={`${onlineButtonClass()} mt-6 w-full py-3 text-base`}
              onClick={() => setRedeemed(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
