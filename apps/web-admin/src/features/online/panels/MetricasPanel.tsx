import { useCallback, useEffect, useState } from 'react';
import { onlineApi, getAccessToken, type OnlineMetrics, type OnlinePublicOrder } from '@/app/api/client';
import { OnlineError, OnlinePanelShell, onlineFieldClass } from '../online-shared';

export function MetricasPanel() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [metrics, setMetrics] = useState<OnlineMetrics | null>(null);
  const [orders, setOrders] = useState<OnlinePublicOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [m, o] = await Promise.all([
        onlineApi.metrics(token, from || undefined, to || undefined),
        onlineApi.orders.list(token, undefined, 20),
      ]);
      setMetrics(m);
      setOrders(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <OnlinePanelShell title="Métricas online">
      {error && <OnlineError message={error} />}
      <div className="flex flex-wrap gap-3">
        <input type="date" className={onlineFieldClass()} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={onlineFieldClass()} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading || !metrics ? (
        <p className="text-sm text-muted-foreground">Cargando métricas...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Pedidos</p>
              <p className="text-2xl font-bold">{metrics.totalPedidos}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Recaudación</p>
              <p className="text-2xl font-bold">${metrics.recaudacion.toLocaleString('es-AR')}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-semibold">Por estado</p>
            <ul className="space-y-1 text-sm">
              {metrics.porEstado.map((s) => (
                <li key={s.status}>
                  {s.status}: {s.count}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-semibold">Top ítems (recaudación)</p>
            <ul className="space-y-1 text-sm">
              {metrics.topItems.map((item) => (
                <li key={item.name}>
                  {item.name} — {item.quantity} u. · ${item.revenue.toLocaleString('es-AR')}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="rounded-xl border border-border">
        <p className="border-b border-border px-4 py-3 font-semibold">Últimos pedidos</p>
        <div className="divide-y divide-border">
          {orders.map((o) => (
            <div key={o.id} className="px-4 py-3 text-sm">
              <p className="font-medium">
                #{o.ticketVenta?.number ?? '—'} · {o.status} · $
                {Number(o.total).toLocaleString('es-AR')}
              </p>
              <p className="text-xs text-muted-foreground">
                {o.cuentaPublica?.email} · {new Date(o.createdAt).toLocaleString('es-AR')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </OnlinePanelShell>
  );
}
