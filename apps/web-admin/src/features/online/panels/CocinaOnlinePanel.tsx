import { useCallback, useEffect, useState } from 'react';
import { QrCode, ScanLine } from 'lucide-react';
import {
  kitchenApi,
  onlineApi,
  getAccessToken,
  type Kitchen,
  type KitchenOrder,
  type RedeemQrResponse,
} from '@/app/api/client';
import { QrScanOverlay } from '../QrScanOverlay';
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

  const active = orders.filter((o) => o.status !== 'delivered');

  return (
    <>
      <OnlinePanelShell title="Cocina online">
        <p className="text-sm text-muted-foreground">
          Cola de pedidos de la cantina web. Usá el botón inferior para escanear el QR de retiro.
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

      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-2xl transition hover:scale-[1.02] active:scale-95"
      >
        <ScanLine size={28} />
        Escanear QR
      </button>

      <QrScanOverlay
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
        loading={redeemLoading}
      />

      {redeemed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-emerald-500/40 bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 text-xl font-bold text-emerald-600">
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
