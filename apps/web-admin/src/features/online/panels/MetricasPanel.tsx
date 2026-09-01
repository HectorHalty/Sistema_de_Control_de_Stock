import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp, Warehouse } from 'lucide-react';
import { onlineApi, getAccessToken, type OnlineMetrics, type OnlinePublicOrder } from '@/app/api/client';
import { OnlineError, OnlinePanelShell } from '../online-shared';

type MetricsRange = '7d' | '30d' | '90d' | 'Año';

function formatMoney(value: number) {
  return `$${value.toLocaleString('es-AR')}`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload?: { tickets?: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const ventas = payload[0]?.value ?? 0;
  const tickets = payload[0]?.payload?.tickets ?? 0;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium capitalize text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-emerald-600">{formatMoney(ventas)}</p>
      <p className="text-xs text-muted-foreground">{tickets} pedido{tickets !== 1 ? 's' : ''}</p>
    </div>
  );
}

export function MetricasPanel() {
  const [range, setRange] = useState<MetricsRange>('7d');
  const [metrics, setMetrics] = useState<OnlineMetrics | null>(null);
  const [orders, setOrders] = useState<OnlinePublicOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKitchen, setActiveKitchen] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [m, o] = await Promise.all([
        onlineApi.metrics(token, undefined, undefined, range),
        onlineApi.orders.list(token, undefined, 15),
      ]);
      setMetrics(m);
      setOrders(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedKitchen = useMemo(
    () =>
      metrics?.topProductsByKitchen.find((k) => k.kitchen === activeKitchen) ??
      metrics?.topProductsByKitchen[0] ??
      null,
    [metrics, activeKitchen],
  );

  const hasData = (metrics?.totalPedidos ?? 0) > 0;

  return (
    <OnlinePanelShell title="Métricas online">
      {error && <OnlineError message={error} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Mismo estilo que ventas: recaudación, evolución diaria y top por cocina.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {(['7d', '30d', '90d', 'Año'] as MetricsRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === r ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading || !metrics ? (
        <p className="text-sm text-muted-foreground">Cargando métricas...</p>
      ) : (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-lg">
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-emerald-100">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm font-medium uppercase tracking-wide">
                    Recaudación online · {range}
                  </span>
                </div>
                <p className="text-4xl font-bold tracking-tight">{formatMoney(metrics.recaudacion)}</p>
                <p className="mt-2 text-sm text-emerald-100/90">
                  Hoy:{' '}
                  <span className="font-semibold text-white">{formatMoney(metrics.recaudacionHoy)}</span>
                  {' · '}
                  {metrics.totalPedidos} pedidos en el período
                </p>
              </div>
              <div className="flex gap-3">
                <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs text-emerald-100">Hoy</p>
                  <p className="text-lg font-bold">{metrics.ticketsHoy}</p>
                  <p className="text-xs text-emerald-100">pedidos</p>
                </div>
                <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs text-emerald-100">Promedio</p>
                  <p className="text-lg font-bold">{formatMoney(metrics.ticketPromedio)}</p>
                  <p className="text-xs text-emerald-100">por pedido</p>
                </div>
              </div>
            </div>
          </div>

          {!hasData && (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No hay pedidos online en este período.
            </div>
          )}

          {hasData && (
            <>
              <div className="rounded-2xl border border-border bg-card p-5">
                <h4 className="mb-4 font-semibold">Evolución de ventas</h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.salesByDay}>
                      <defs>
                        <linearGradient id="onlineVentasGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="ventas"
                        stroke="#10b981"
                        fill="url(#onlineVentasGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h4 className="mb-3 font-semibold">Pedidos por estado</h4>
                  <ul className="space-y-2 text-sm">
                    {metrics.porEstado.map((s) => (
                      <li key={s.status} className="flex justify-between">
                        <span className="capitalize text-muted-foreground">{s.status.replace(/_/g, ' ')}</span>
                        <strong>{s.count}</strong>
                      </li>
                    ))}
                  </ul>
                </div>

                {metrics.topProductsByKitchen.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Warehouse className="h-5 w-5 text-emerald-600" />
                      <h4 className="font-semibold">Ventas por cocina</h4>
                    </div>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={metrics.topProductsByKitchen.map((k) => ({
                            name: k.kitchen,
                            unidades: k.totalUnits,
                            color: k.color,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="unidades" radius={[4, 4, 0, 0]}>
                            {metrics.topProductsByKitchen.map((k) => (
                              <Cell key={k.id} fill={k.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {metrics.topProductsByKitchen.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h4 className="mb-3 font-semibold">Top productos por cocina</h4>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {metrics.topProductsByKitchen.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setActiveKitchen(k.kitchen)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                          (activeKitchen ?? metrics.topProductsByKitchen[0]?.kitchen) === k.kitchen
                            ? 'text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                        style={
                          (activeKitchen ?? metrics.topProductsByKitchen[0]?.kitchen) === k.kitchen
                            ? { backgroundColor: k.color }
                            : undefined
                        }
                      >
                        {k.kitchen}
                      </button>
                    ))}
                  </div>
                  {selectedKitchen && (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={selectedKitchen.products} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {selectedKitchen.products.map((p) => (
                              <Cell key={p.id} fill={selectedKitchen.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

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
            <p className="border-b border-border px-4 py-3 font-semibold">Últimos pedidos online</p>
            <div className="divide-y divide-border">
              {orders.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Sin pedidos recientes.</p>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">
                      #{o.ticketVenta?.number ?? '—'} · {o.status} · $
                      {Number(o.total).toLocaleString('es-AR')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.cuentaPublica?.email} · {new Date(o.createdAt).toLocaleString('es-AR')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </OnlinePanelShell>
  );
}
