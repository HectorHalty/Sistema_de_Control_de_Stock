import { useMemo, useState } from "react";
import { CheckCircle2, Ban, Receipt, RotateCcw, Clock } from "lucide-react";
import { useStore, Ticket } from "./VentasPosContext";
import { EditableOrderModal } from "./EditableOrderModal";
import { useAppContext } from "../../AppContext";
import { getVentasAuditEntries } from "../../../utils/audit-log";

type Filter = "todos" | "emitido" | "anulado" | "devolucion";
type View = "tickets" | "cambios";

export function HistoryModule() {
  const { tickets, users, replaceTicketItems, voidTicket, products, setToast } =
    useStore();
  const { auditLog, salesAuditLog } = useAppContext();
  const ventasAuditEntries = useMemo(
    () => getVentasAuditEntries(auditLog, salesAuditLog),
    [auditLog, salesAuditLog],
  );
  const [view, setView] = useState<View>("tickets");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<Filter>("todos");
  const [orderModal, setOrderModal] = useState<Ticket | null>(null);

  const filtered = tickets.filter((t) => {
    if (userFilter !== "all" && t.operatorId !== userFilter) return false;
    if (statusFilter === "anulado" && t.status !== "anulado") return false;
    if (statusFilter === "emitido" && (t.status !== "emitido" || t.kind !== "venta")) return false;
    if (statusFilter === "devolucion" && t.kind !== "devolucion") return false;
    return true;
  });

  const stats = users.map((u) => {
    const userTickets = tickets.filter((t) => t.operatorId === u.id);
    const ventas = userTickets.filter((t) => t.status === "emitido" && t.kind === "venta");
    const anulados = userTickets.filter((t) => t.status === "anulado");
    const devoluciones = userTickets.filter((t) => t.kind === "devolucion");
    return {
      user: u,
      ventasCount: ventas.length,
      ventasTotal: ventas.reduce((s, t) => s + t.total, 0),
      anuladosCount: anulados.length,
      anuladosTotal: anulados.reduce((s, t) => s + t.total, 0),
      devolucionesCount: devoluciones.length,
      devolucionesTotal: devoluciones.reduce((s, t) => s + t.total, 0),
    };
  });

  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setView("tickets")}
          className={`px-4 py-1.5 rounded text-sm ${view === "tickets" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}
        >
          Tickets
        </button>
        <button
          type="button"
          onClick={() => setView("cambios")}
          className={`px-4 py-1.5 rounded text-sm ${view === "cambios" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}
        >
          Historial de cambios
        </button>
      </div>

      {view === "cambios" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-700" />
            <h3 className="text-gray-900">Historial de cambios — Ventas</h3>
          </div>
          {ventasAuditEntries.length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-500">Sin registros de cambios en ventas</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-left px-4 py-2">Usuario</th>
                    <th className="text-left px-4 py-2">Acción</th>
                    <th className="text-left px-4 py-2">Elemento</th>
                    <th className="text-right px-4 py-2">Anterior</th>
                    <th className="text-right px-4 py-2">Nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasAuditEntries.map(entry => (
                    <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{entry.date}</td>
                      <td className="px-4 py-2">{entry.user}</td>
                      <td className="px-4 py-2 text-gray-600">{entry.action}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">{entry.element}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{entry.previousValue || "-"}</td>
                      <td className="px-4 py-2 text-right font-medium">{entry.newValue || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "tickets" && (
      <>
      <div>
        <h3 className="text-gray-900 mb-3">Resumen por Operador</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.user.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
                  {s.user.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-gray-900 truncate">{s.user.name}</div>
                  <div className="text-xs text-gray-500">{s.user.role}</div>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ventas
                  </span>
                  <span className="text-gray-900">
                    {s.ventasCount} · ${s.ventasTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-red-600">
                    <Ban className="w-3.5 h-3.5" /> Anulados
                  </span>
                  <span className="text-gray-900">
                    {s.anuladosCount} · ${s.anuladosTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-amber-700">
                    <RotateCcw className="w-3.5 h-3.5" /> Devoluciones
                  </span>
                  <span className="text-gray-900">
                    {s.devolucionesCount} · ${s.devolucionesTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-2 mb-3 sm:items-center sm:justify-between">
          <h3 className="text-gray-900">Registro de Tickets ({filtered.length})</h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-sm"
            >
              <option value="all">Todos los operadores</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(["todos", "emitido", "anulado", "devolucion"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded text-sm ${
                    statusFilter === f ? "bg-white shadow" : "text-gray-600"
                  }`}
                >
                  {f === "todos"
                    ? "Todos"
                    : f === "emitido"
                    ? "Ventas"
                    : f === "anulado"
                    ? "Anulados"
                    : "Devoluciones"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Aún no hay tickets registrados con estos filtros
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setOrderModal(t)}
                className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 transition hover:border-emerald-400 ${
                  t.status === "anulado"
                    ? "border-red-200 bg-red-50/50"
                    : t.kind === "devolucion"
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    t.status === "anulado"
                      ? "bg-red-100 text-red-600"
                      : t.kind === "devolucion"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {t.status === "anulado" ? (
                    <Ban className="w-5 h-5" />
                  ) : t.kind === "devolucion" ? (
                    <RotateCcw className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-900">
                      Ticket #{t.number}
                      {t.kind === "devolucion" && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                          DEVOLUCIÓN
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        t.status === "anulado"
                          ? "text-red-600 line-through"
                          : t.kind === "devolucion"
                          ? "text-red-600"
                          : "text-emerald-600"
                      }
                    >
                      {t.kind === "devolucion" ? "-" : ""}${t.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {t.operator} · {t.createdAt} · {t.items.length} ítems · {t.source}
                    {t.context ? ` · ${t.context}` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {orderModal && (
        <EditableOrderModal
          ticket={orderModal}
          products={products}
          onClose={() => setOrderModal(null)}
          onSave={(id, items) => replaceTicketItems(id, items)}
          onVoid={(id) => voidTicket(id)}
          setToast={setToast}
        />
      )}
      </>
      )}
    </div>
  );
}
