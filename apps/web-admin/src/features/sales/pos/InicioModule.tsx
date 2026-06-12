import { useCallback, useMemo } from "react";
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
import {
  TrendingUp,
  Users,
  Clock,
  Warehouse,
  Package,
} from "lucide-react";
import { useStore } from "./VentasPosContext";
import {
  computeDashboardMetrics,
  filterTicketsToday,
} from "../sales-metrics";

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
      <p className="text-xs font-medium capitalize text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(ventas)}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{tickets} ticket{tickets !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function InicioModule() {
  const { salesTickets, products, kitchens } = useStore();

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

  const todayTickets = useMemo(
    () => filterTicketsToday(salesTickets),
    [salesTickets],
  );

  const ventasHoy = todayTickets.reduce((s, t) => s + t.total, 0);
  const ticketsHoy = todayTickets.length;

  const topProductToday = useMemo(() => {
    const map = new Map<string, { name: string; units: number }>();
    for (const ticket of todayTickets) {
      for (const item of ticket.items) {
        const prev = map.get(item.salesProductId) ?? { name: item.name, units: 0 };
        map.set(item.salesProductId, {
          name: item.name,
          units: prev.units + item.quantity,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.units - a.units)[0] ?? null;
  }, [todayTickets]);

  const metrics = useMemo(
    () => computeDashboardMetrics(salesTickets, "7d", resolveKitchen),
    [salesTickets, resolveKitchen],
  );

  const empleadoDelDia = metrics.employeesToday[0] ?? null;
  const maxEmployeeSales = empleadoDelDia?.totalVentas ?? 1;

  const cards = [
    {
      label: "Ventas del día",
      value: formatMoney(ventasHoy),
      sub: ticketsHoy > 0 ? `${ticketsHoy} venta${ticketsHoy !== 1 ? "s" : ""} registrada${ticketsHoy !== 1 ? "s" : ""}` : "Sin ventas hoy",
      icon: TrendingUp,
      color: "bg-blue-600",
    },
    {
      label: "Producto más vendido",
      value: topProductToday?.name ?? "—",
      sub: topProductToday
        ? `${topProductToday.units} unidad${topProductToday.units !== 1 ? "es" : ""} hoy`
        : "Sin datos hoy",
      icon: Package,
      color: "bg-amber-600",
      valueClass: "text-lg sm:text-xl line-clamp-2",
    },
    {
      label: "Empleado del día",
      value: empleadoDelDia?.name ?? "—",
      sub: empleadoDelDia
        ? `${formatMoney(empleadoDelDia.totalVentas)} · más ventas`
        : "Sin ventas hoy",
      icon: Users,
      color: "bg-purple-600",
      valueClass: "text-xl",
    },
  ];

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl text-gray-900 dark:text-gray-100">Dashboard Principal</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Vista general de métricas y rendimiento
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <Clock className="h-4 w-4" />
          <span>Actualizado ahora</span>
        </div>
      </div>

      {/* Tarjetas superiores — datos reales del día */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:p-4"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${c.color}`}>
              <c.icon size={20} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-muted-foreground">{c.label}</p>
              <p className={`text-lg font-semibold leading-tight text-foreground ${"valueClass" in c ? c.valueClass : ""}`}>
                {c.value}
              </p>
              <p className="truncate text-xs font-medium text-[#3d7a3d]">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {ticketsHoy === 0 && metrics.ticketsCount === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
          Sin ventas registradas. Empezá a vender en Mostrador para ver métricas aquí.
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Evolución 7 días */}
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h4 className="text-gray-900 dark:text-gray-100">Evolución de ventas (7 días)</h4>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.salesByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inicioVentasGradient" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#inicioVentasGradient)"
                    dot={{ fill: "#059669", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 6, fill: "#059669", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Empleados del día */}
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h4 className="text-gray-900 dark:text-gray-100">Empleados del día</h4>
              <span className="ml-auto text-xs text-muted-foreground">
                {format(new Date(), "dd/MM/yyyy")}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {metrics.employeesToday.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin ventas hoy</p>
              ) : (
                metrics.employeesToday.map((emp, idx) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0
                          ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                          : "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300"
                      }`}
                    >
                      {initials(emp.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {emp.name}
                        </p>
                        <p className="shrink-0 text-sm font-semibold text-emerald-600">
                          {formatMoney(emp.totalVentas)}
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                          style={{
                            width: `${Math.max(8, (emp.totalVentas / maxEmployeeSales) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {emp.tickets} tickets · {emp.unitsSold} u.
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ventas por cocina */}
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-[#3d7a3d]" />
              <h4 className="text-gray-900 dark:text-gray-100">Unidades por cocina (7 días)</h4>
            </div>
            {metrics.topProductsByKitchen.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin datos</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.topProductsByKitchen.map((k) => ({
                      name: k.kitchen,
                      unidades: k.totalUnits,
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
                      formatter={(v: number) => [`${v} u.`, "Vendidas"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                    />
                    <Bar dataKey="unidades" radius={[8, 8, 0, 0]} maxBarSize={44}>
                      {metrics.topProductsByKitchen.map((k) => (
                        <Cell key={k.id} fill={k.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top productos por cocina */}
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-[#3d7a3d]" />
              <h4 className="text-gray-900 dark:text-gray-100">
                Productos más vendidos por cocina
              </h4>
            </div>
            {metrics.topProductsByKitchen.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin productos vendidos</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metrics.topProductsByKitchen.map((kitchen) => (
                  <div
                    key={kitchen.id}
                    className="rounded-xl border border-gray-100 p-4 dark:border-gray-700"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: kitchen.color }}
                      />
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {kitchen.kitchen}
                      </h5>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {kitchen.totalUnits} u.
                      </span>
                    </div>
                    {kitchen.products.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin ventas</p>
                    ) : (
                      <ul className="space-y-2">
                        {kitchen.products.map((p, idx) => (
                          <li key={p.id} className="flex items-center gap-2">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                              style={{
                                backgroundColor: kitchen.color,
                                opacity: 1 - idx * 0.15,
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-gray-300">
                              {p.name}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-gray-900 dark:text-gray-100">
                              {p.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
