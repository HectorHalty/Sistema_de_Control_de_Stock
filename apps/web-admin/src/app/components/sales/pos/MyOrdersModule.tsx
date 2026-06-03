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
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
          {currentUser.name
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div className="flex-1">
          <div className="text-gray-900">{currentUser.name}</div>
          <div className="text-xs text-gray-500">Sesión activa</div>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="text-center">
            <div className="text-emerald-600">{ventas.length}</div>
            <div className="text-xs text-gray-500">Ventas</div>
          </div>
          <div className="text-center">
            <div className="text-red-600">{anulados.length}</div>
            <div className="text-xs text-gray-500">Anulados</div>
          </div>
          <div className="text-center">
            <div className="text-amber-600">{devoluciones.length}</div>
            <div className="text-xs text-gray-500">Devoluc.</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-3">Mis Pedidos ({mine.length})</h3>

        {mine.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
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
                    ? "border-red-200 bg-red-50/50"
                    : t.kind === "devolucion"
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    t.status === "anulado"
                      ? "bg-red-100 text-red-600"
                      : t.kind === "devolucion"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
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
                    <span className="text-gray-900 font-medium">#{t.number}</span>
                    {t.status === "anulado" && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                        ANULADO
                      </span>
                    )}
                    {t.kind === "devolucion" && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                        DEVOLUCIÓN
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {t.createdAt} · {t.items.length} ítems · {t.source}
                  </div>
                </div>
                <span
                  className={`shrink-0 font-semibold ${
                    t.status === "anulado"
                      ? "text-gray-500 line-through"
                      : t.kind === "devolucion"
                      ? "text-red-600"
                      : "text-emerald-600"
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
          onSave={(id, items) => replaceTicketItems(id, items)}
          onVoid={(id) => voidTicket(id)}
          setToast={setToast}
        />
      )}
    </div>
  );
}
