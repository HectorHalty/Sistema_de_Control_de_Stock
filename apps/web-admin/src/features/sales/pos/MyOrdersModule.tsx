import { useState } from "react";
import { Ban, ClipboardList, RotateCcw, CheckCircle2 } from "lucide-react";
import { useStore, Ticket } from "./VentasPosContext";
import { EditableOrderModal } from "./EditableOrderModal";

export function MyOrdersModule() {
  const {
    tickets,
    currentUser,
    voidTicket,
    replaceTicketItems,
    products,
    setToast,
  } = useStore();
  const mine = tickets.filter((t) => t.operatorId === currentUser.id);
  const [orderModal, setOrderModal] = useState<Ticket | null>(null);

  const ventas = mine.filter((t) => t.kind === "venta" && t.status === "emitido");
  const anulados = mine.filter((t) => t.status === "anulado");
  const devoluciones = mine.filter((t) => t.kind === "devolucion");

  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
          {currentUser.name
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div className="flex-1">
          <div className="text-foreground">{currentUser.name}</div>
          <div className="text-xs text-muted-foreground">Sesión activa</div>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="text-center">
            <div className="text-emerald-600 dark:text-emerald-400">{ventas.length}</div>
            <div className="text-xs text-muted-foreground">Ventas</div>
          </div>
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400">{anulados.length}</div>
            <div className="text-xs text-muted-foreground">Anulados</div>
          </div>
          <div className="text-center">
            <div className="text-amber-600 dark:text-amber-400">{devoluciones.length}</div>
            <div className="text-xs text-muted-foreground">Devoluc.</div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-foreground mb-3">Mis Pedidos ({mine.length})</h3>

        {mine.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Aún no realizaste pedidos en tu sesión
          </div>
        ) : (
          <div className="space-y-2">
            {mine.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOrderModal(t)}
                className={`w-full rounded-lg border p-3 flex items-center gap-3 text-left transition hover:border-emerald-400 hover:shadow-sm ${
                  t.status === "anulado"
                    ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/40"
                    : t.kind === "devolucion"
                    ? "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/40"
                    : "border-border bg-card"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    t.status === "anulado"
                      ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                      : t.kind === "devolucion"
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                      : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {t.status === "anulado" ? (
                    <Ban className="w-4 h-4" />
                  ) : t.kind === "devolucion" ? (
                    <RotateCcw className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground font-medium">#{t.number}</span>
                    {t.status === "anulado" && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded">
                        ANULADO
                      </span>
                    )}
                    {t.kind === "devolucion" && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded">
                        DEVOLUCIÓN
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.createdAt} · {t.items.length} ítems · {t.source}
                  </div>
                </div>
                <span
                  className={`shrink-0 font-semibold ${
                    t.status === "anulado"
                      ? "text-muted-foreground line-through"
                      : t.kind === "devolucion"
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {t.kind === "devolucion" ? "-" : ""}${t.total.toLocaleString("es-AR")}
                </span>
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
          onSave={async (id, items) => { await replaceTicketItems(id, items); }}
          onVoid={(id) => voidTicket(id)}
          setToast={setToast}
        />
      )}
    </div>
  );
}
