import { useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  Printer,
  X,
} from "lucide-react";
import { OrderItem } from "./mockData";
import { useStore, Ticket } from "./VentasPosContext";
import { EditableOrderModal } from "./EditableOrderModal";
import { PosProductPicker } from "./PosProductPicker";

export function POSModule() {
  const {
    tickets,
    printTicket: storePrint,
    voidTicket,
    replaceTicketItems,
    printers,
    products,
    currentUser,
    setToast,
  } = useStore();
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [showMobileOrder, setShowMobileOrder] = useState(false);
  const [previewTicket, setPreviewTicket] = useState<Ticket | null>(null);
  const defaultPrinter = printers.find((p) => p.isDefault && p.connected) || printers.find((p) => p.connected);
  const recent = tickets.slice(0, 6);
  const editingTicket = tickets.find((t) => t.id === editingTicketId) || null;

  const addToOrder = (p: (typeof products)[number]) => {
    setOrder((prev) => {
      const ex = prev.find((i) => i.productId === p.id);
      const nextQty = (ex?.qty ?? 0) + 1;
      if (nextQty > p.stock) {
        setToast(`Stock máximo para "${p.name}": ${p.stock}`);
        setTimeout(() => setToast(null), 2200);
        return prev;
      }
      if (ex) return prev.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setOrder((prev) =>
      prev
        .map((i) => (i.productId === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (id: string) =>
    setOrder((prev) => prev.filter((i) => i.productId !== id));

  const total = order.reduce((s, i) => s + i.price * i.qty, 0);

  const printTicket = async () => {
    if (order.length === 0) return;
    if (!defaultPrinter) {
      setToast("⚠️ No hay impresora conectada. Configurala en Ajustes.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (editingTicket) {
      const updated = replaceTicketItems(editingTicket.id, order);
      if (updated) {
        setToast(`✏️ Comanda #${updated.number} actualizada y reimpresa`);
      }
      setEditingTicketId(null);
    } else {
      const t = await storePrint({ items: order, total, source: "Mostrador" });
      if (!t) return;
      setToast(`✅ Pedido #${t.number} realizado con éxito — enviado a ${defaultPrinter.name}`);
    }
    setOrder([]);
    setShowMobileOrder(false);
    setTimeout(() => setToast(null), 2500);
  };

  const cancelEditing = () => {
    setEditingTicketId(null);
    setOrder([]);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <div className="flex min-h-0 flex-1 flex-col">
        <PosProductPicker
          products={products}
          onSelect={addToOrder}
          listClassName="flex flex-1 flex-col gap-2 overflow-y-auto pb-24 lg:pb-2"
        />
      </div>

      <div
        className={`${
          showMobileOrder ? "fixed inset-0 z-40 bg-white p-4 flex" : "hidden"
        } lg:relative lg:flex lg:inset-auto lg:p-0 lg:w-96 flex-col bg-white rounded-xl border border-gray-200 lg:p-4`}
      >
        <div className="flex justify-between items-center mb-3 lg:mb-4">
          <div>
            <h3 className="text-gray-900">
              {editingTicket ? `Editando #${editingTicket.number}` : "Comanda Actual"}
            </h3>
            {editingTicket && (
              <button
                onClick={cancelEditing}
                className="text-xs text-red-600 underline"
              >
                Cancelar edición
              </button>
            )}
          </div>
          <button
            onClick={() => setShowMobileOrder(false)}
            className="lg:hidden text-gray-500"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {order.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              Toca productos para agregarlos
            </div>
          ) : (
            order.map((i) => (
              <div
                key={i.productId}
                className="bg-gray-50 rounded-lg p-3 flex items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 truncate">{i.name}</div>
                  <div className="text-emerald-600 text-sm">
                    ${(i.price * i.qty).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(i.productId, -1)}
                    className="w-7 h-7 rounded bg-white border border-gray-200 flex items-center justify-center"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center">{i.qty}</span>
                  <button
                    onClick={() => updateQty(i.productId, 1)}
                    className="w-7 h-7 rounded bg-white border border-gray-200 flex items-center justify-center"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeItem(i.productId)}
                    className="w-7 h-7 rounded bg-red-50 text-red-500 flex items-center justify-center ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-200 mt-3 pt-3 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Items:</span>
            <span>{order.reduce((s, i) => s + i.qty, 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-900">Total:</span>
            <span className="text-emerald-600 text-xl">${total.toLocaleString()}</span>
          </div>
          <button
            onClick={printTicket}
            disabled={order.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Printer className="w-5 h-5" />
            {editingTicket ? "Reimprimir Ticket" : "Imprimir Ticket"}
          </button>
          <div className="text-xs text-gray-500 text-center">
            {defaultPrinter ? (
              <>Imprime en <span className="text-emerald-600">{defaultPrinter.name}</span></>
            ) : (
              <span className="text-red-500">Sin impresora conectada</span>
            )}
          </div>
        </div>

        {recent[0] && (
          <div className="border-t border-gray-200 mt-3 pt-3">
            <div className="text-sm text-gray-600 mb-2">Último pedido</div>
            <button
              onClick={() => setPreviewTicket(recent[0])}
              className={`w-full text-left rounded-lg border p-3 transition hover:shadow-sm ${
                recent[0].status === "anulado"
                  ? "border-red-200 bg-red-50/50"
                  : recent[0].kind === "devolucion"
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-gray-200 bg-gray-50 hover:border-emerald-400"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="flex items-center gap-1.5 text-gray-900">
                  Ticket #{recent[0].number}
                  {recent[0].status === "anulado" && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                      ANULADO
                    </span>
                  )}
                  {recent[0].kind === "devolucion" && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                      DEVOLUCIÓN
                    </span>
                  )}
                </span>
                <span
                  className={
                    recent[0].status === "anulado"
                      ? "text-gray-500 line-through"
                      : recent[0].kind === "devolucion"
                      ? "text-red-600"
                      : "text-emerald-600"
                  }
                >
                  {recent[0].kind === "devolucion" ? "-" : ""}$
                  {recent[0].total.toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-gray-500 truncate">
                {recent[0].items.length} ítems · {recent[0].createdAt}
              </div>
              {recent[0].status === "emitido" && recent[0].kind === "venta" && (
                <div className="text-xs text-emerald-700 mt-1">
                  Tocá para editar el pedido
                </div>
              )}
            </button>
          </div>
        )}
      </div>

      {!showMobileOrder && order.length > 0 && (
        <button
          onClick={() => setShowMobileOrder(true)}
          className="lg:hidden fixed bottom-20 right-4 z-30 bg-emerald-600 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2"
        >
          🛒 {order.reduce((s, i) => s + i.qty, 0)} · ${total.toLocaleString()}
        </button>
      )}

      {previewTicket && (
        <EditableOrderModal
          ticket={previewTicket}
          products={products}
          onClose={() => setPreviewTicket(null)}
          onSave={(id, items) => replaceTicketItems(id, items)}
          onVoid={(id) => voidTicket(id)}
          setToast={setToast}
        />
      )}

    </div>
  );
}
