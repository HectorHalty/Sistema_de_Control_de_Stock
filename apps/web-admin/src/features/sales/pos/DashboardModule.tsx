import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
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
} from "recharts";
import { TrendingUp, Users, Warehouse, Package } from "lucide-react";
import { useStore } from "./VentasPosContext";
import {
  computeDashboardMetrics,
  KITCHEN_CHART_COLORS,
  type MetricsRange,
} from "../sales-metrics";

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
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
    <div className="rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/95">
      <p className="text-xs font-medium capitalize text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(ventas)}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{tickets} ticket{tickets !== 1 ? "s" : ""}</p>
    </div>
  );
}

function KitchenBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: { name: string; value: number; revenue: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="max-w-[10rem] truncate text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</p>
      <p className="text-sm text-emerald-600 dark:text-emerald-400">{row.value} u. · {formatMoney(row.revenue)}</p>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DashboardModule() {
  const { salesTickets, products, kitchens } = useStore();
  const [range, setRange] = useState<MetricsRange>("7d");
  const [activeKitchen, setActiveKitchen] = useState<string | null>(null);

  const resolveKitchen = useCallback(
    (productId: string, kitchenId: string) => {
      const k = kitchens.find((x) => x.id === kitchenId);
      if (k) return k.name;
      const p = products.find((x) => x.id === productId);
      if (p) return p.station;
      return "Sin cocina";
    },
    [kitchens, products],
  );

  const metrics = useMemo(
    () => computeDashboardMetrics(salesTickets, range, resolveKitchen),
    [salesTickets, range, resolveKitchen],
  );

  const selectedKitchen =
    metrics.topProductsByKitchen.find((k) => k.kitchen === activeKitchen) ??
    metrics.topProductsByKitchen[0] ??
    null;

  const maxEmployeeSales = metrics.employeesToday[0]?.totalVentas ?? 1;
  const hasData = metrics.ticketsCount > 0;

  return (
    <div className="space-y-5 pb-6">
      {/* Header + rango */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Dashboard de Ventas
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Resumen en tiempo real desde mostrador
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
          {(["7d", "30d", "90d", "Año"] as MetricsRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === r
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Ventas totales — hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-100">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wide">
                Ventas totales · {range}
              </span>
            </div>
            <p className="text-4xl font-bold tracking-tight sm:text-5xl">
              {formatMoney(metrics.totalVentas)}
            </p>
            <p className="mt-2 text-sm text-emerald-100/90">
              Hoy: <span className="font-semibold text-white">{formatMoney(metrics.ventasHoy)}</span>
              {" · "}
              {metrics.ticketsCount} tickets en el período
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs text-emerald-100">Hoy</p>
              <p className="text-lg font-bold">{metrics.ticketsHoy}</p>
              <p className="text-xs text-emerald-100">tickets</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs text-emerald-100">Promedio</p>
              <p className="text-lg font-bold">{formatMoney(metrics.ticketPromedio)}</p>
              <p className="text-xs text-emerald-100">por ticket</p>
            </div>
          </div>
        </div>
      </div>

      {!hasData && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
          No hay ventas en este período. Registrá tickets en Mostrador para ver métricas.
        </div>
      )}

      {hasData && (
        <>
          {/* Gráfico principal */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                Evolución de ventas
              </h4>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.salesByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ventasGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fill="url(#ventasGradient)"
                    dot={{ fill: "#059669", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 6, fill: "#059669", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Empleados del día */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  Empleados del día
                </h4>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(), "dd/MM/yyyy")}
                </span>
              </div>
              {metrics.employeesToday.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sin ventas registradas hoy
                </p>
              ) : (
                <ul className="space-y-3">
                  {metrics.employeesToday.map((emp, idx) => (
                    <li
                      key={emp.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          idx === 0
                            ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                            : "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300"
                        }`}
                      >
                        {initials(emp.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                            {emp.name}
                            {idx === 0 && (
                              <span className="ml-2 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                                Top del día
                              </span>
                            )}
                          </p>
                          <p className="shrink-0 font-semibold text-emerald-600">
                            {formatMoney(emp.totalVentas)}
                          </p>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                            style={{
                              width: `${Math.max(8, (emp.totalVentas / maxEmployeeSales) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {emp.tickets} ticket{emp.tickets !== 1 ? "s" : ""} · {emp.unitsSold} unidades
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Top por cocina — resumen */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-[#3d7a3d]" />
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  Ventas por cocina
                </h4>
              </div>
              {metrics.topProductsByKitchen.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sin datos por cocina</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.topProductsByKitchen.map((k) => ({
                        name: k.kitchen,
                        unidades: k.totalUnits,
                        color: k.color,
                      }))}
                      margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: number) => [`${v} u.`, "Unidades"]}
                        contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                      />
                      <Bar dataKey="unidades" radius={[8, 8, 0, 0]} maxBarSize={48}>
                        {metrics.topProductsByKitchen.map((k) => (
                          <Cell key={k.id} fill={k.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Productos más vendidos por cocina */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#3d7a3d]" />
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  Productos más vendidos por cocina
                </h4>
              </div>
              {metrics.topProductsByKitchen.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {metrics.topProductsByKitchen.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setActiveKitchen(k.kitchen)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        (activeKitchen ?? metrics.topProductsByKitchen[0]?.kitchen) === k.kitchen
                          ? "text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
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
              )}
            </div>

            {!selectedKitchen || selectedKitchen.products.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin productos vendidos en el período
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="h-64 min-h-[16rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={selectedKitchen.products}
                      margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fill: "#6b7280", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<KitchenBarTooltip />} />
                      <Bar
                        dataKey="value"
                        fill={selectedKitchen.color}
                        radius={[0, 8, 8, 0]}
                        maxBarSize={22}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2">
                  {selectedKitchen.products.map((p, idx) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-gray-700"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{
                          backgroundColor:
                            KITCHEN_CHART_COLORS[selectedKitchen.kitchen] ?? "#10b981",
                          opacity: 1 - idx * 0.12,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatMoney(p.revenue)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {p.value} u.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
