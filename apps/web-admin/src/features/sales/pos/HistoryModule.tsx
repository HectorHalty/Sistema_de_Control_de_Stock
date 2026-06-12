import { useMemo, useState } from "react";
import { CheckCircle2, Ban, Receipt, RotateCcw, Clock } from "lucide-react";
import { useStore, Ticket } from "./VentasPosContext";
import { EditableOrderModal } from "./EditableOrderModal";
import { useAppContext } from '@/app/providers/AppContext';
import { getVentasAuditEntries } from '@/shared/utils/audit-log';
import { AuditHistoryTable } from '@/shared/components/AuditHistoryTable';

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
      <div className="flex bg-muted rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setView("tickets")}
          className={`px-4 py-1.5 rounded text-sm ${view === "tickets" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
        >
          Tickets
        </button>
        <button
          type="button"
          onClick={() => setView("cambios")}
          className={`px-4 py-1.5 rounded text-sm ${view === "cambios" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
        >
          Historial de cambios
        </button>
      </div>

      {view === "cambios" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
            <h3 className="text-foreground">Historial de cambios — Ventas</h3>
          </div>
          <AuditHistoryTable
            entries={ventasAuditEntries}
            emptyMessage="Sin registros de cambios en ventas"
            dateColumnLabel="Fecha"
            compact
          />
        </div>
      )}

      {view === "tickets" && (
      <>
      <div>
        <h3 className="text-foreground mb-3">Resumen por Operador</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.user.id}
              className="bg-card rounded-xl border border-border p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-sm">
                  {s.user.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-foreground truncate">{s.user.name}</div>
                  <div className="text-xs text-muted-foreground">{s.user.role}</div>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ventas
                  </span>
                  <span className="text-foreground">
                    {s.ventasCount} · ${s.ventasTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <Ban className="w-3.5 h-3.5" /> Anulados
                  </span>
                  <span className="text-foreground">
                    {s.anuladosCount} · ${s.anuladosTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <RotateCcw className="w-3.5 h-3.5" /> Devoluciones
                  </span>
                  <span className="text-foreground">
                    {s.devolucionesCount} · ${s.devolucionesTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-2 mb-3 sm:items-center sm:justify-between">
          <h3 className="text-foreground">Registro de Tickets ({filtered.length})</h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg bg-input-background text-sm"
            >
              <option value="all">Todos los operadores</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <div className="flex bg-muted rounded-lg p-1">
              {(["todos", "emitido", "anulado", "devolucion"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded text-sm ${
                    statusFilter === f ? "bg-card shadow" : "text-muted-foreground"
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
          <div className="text-center py-12 text-muted-foreground">
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
                    ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/40"
                    : t.kind === "devolucion"
                    ? "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/40"
                    : "border-border bg-card"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    t.status === "anulado"
                      ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                      : t.kind === "devolucion"
                      ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                      : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
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
                    <span className="text-foreground">
                      Ticket #{t.number}
                      {t.kind === "devolucion" && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded">
                          DEVOLUCIÓN
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        t.status === "anulado"
                          ? "text-red-600 dark:text-red-400 line-through"
                          : t.kind === "devolucion"
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {t.kind === "devolucion" ? "-" : ""}${t.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
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
