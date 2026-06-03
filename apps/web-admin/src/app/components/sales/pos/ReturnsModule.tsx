import { useMemo, useState } from "react";
import { Plus, Minus, Search, Printer, RotateCcw, X } from "lucide-react";
import { Product, OrderItem } from "./mockData";
import { useStore, Ticket } from "./VentasPosContext";
import { TicketPreview } from "./TicketPreview";
import { getReturnableQuantities } from "./returnable-products";

export function ReturnsModule() {
  const { products, printReturn, template, printers, tickets } = useStore();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const defaultPrinter = printers.find((p) => p.isDefault) || printers[0];

  const returnableQty = useMemo(() => getReturnableQuantities(tickets), [tickets]);

  const returnableProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const max = returnableQty.get(p.id) ?? 0;
      if (max <= 0) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, returnableQty, query]);

  const remainingFor = (productId: string) => {
    const max = returnableQty.get(productId) ?? 0;
    const inCart = items.find((i) => i.productId === productId)?.qty ?? 0;
    return Math.max(0, max - inCart);
  };

  const add = (p: Product) => {
    if (remainingFor(p.id) <= 0) return;
    setItems((prev) => {
      const ex = prev.find((i) => i.productId === p.id);
      if (ex) {
        return prev.map((i) =>
          i.productId === p.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setItems((prev) => {
      const next = prev
        .map((i) => (i.productId === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0);
      return next.map((i) => {
        const cap = returnableQty.get(i.productId) ?? 0;
        return i.qty > cap ? { ...i, qty: cap } : i;
      });
    });
  };

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const confirm = () => {
    if (items.length === 0) return;
    const t = printReturn(items);
    if (!t) return;
    setPreview(t);
    setItems([]);
    setToast(`✅ Devolución #${t.number} registrada con éxito`);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-20 lg:pb-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-[60vh]">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="w-5 h-5 text-amber-600" />
          <h3 className="text-gray-900">Productos vendidos</h3>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Solo podés devolver productos que se hayan vendido y aún no fueron devueltos por completo.
        </p>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar entre vendidos..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {returnableProducts.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm px-2">
              {returnableQty.size === 0
                ? "No hay ventas registradas para devolver."
                : "No hay coincidencias con la búsqueda."}
            </div>
          ) : (
            returnableProducts.map((p) => {
              const max = returnableQty.get(p.id) ?? 0;
              const canAdd = remainingFor(p.id) > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!canAdd}
                  onClick={() => add(p)}
                  className={`w-full text-left rounded-lg p-2 flex items-center gap-2 transition ${
                    canAdd
                      ? "bg-gray-50 hover:bg-amber-50"
                      : "bg-gray-50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <span className="text-2xl w-8 text-center">{p.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-900 truncate">{p.name}</span>
                    <span className="text-xs text-gray-500">
                      Pendiente de devolver: {remainingFor(p.id)} / {max}
                    </span>
                  </span>
                  <span className="text-sm text-emerald-600 shrink-0">
                    ${p.price.toLocaleString("es-AR")}
                  </span>
                  {canAdd && <Plus className="w-4 h-4 text-amber-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-amber-50/40 rounded-xl border border-amber-200 p-4 flex flex-col min-h-[60vh]">
        <h3 className="text-gray-900 mb-1">Productos a devolver</h3>
        <div className="text-xs text-gray-500 mb-3">
          Se sumarán al stock y se descontará el monto total.
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 mb-3">
          {items.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm">
              Seleccioná productos vendidos de la izquierda
            </div>
          ) : (
            items.map((i) => {
              const max = returnableQty.get(i.productId) ?? 0;
              const canIncrease = i.qty < max;
              return (
                <div
                  key={i.productId}
                  className="bg-white rounded-lg p-2 flex items-center gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">{i.name}</div>
                    <div className="text-xs text-gray-500">
                      Máx. {max} unidad(es) vendida(s)
                    </div>
                    <div className="text-xs text-red-600">
                      -${(i.qty * i.price).toLocaleString("es-AR")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateQty(i.productId, -1)}
                    className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-sm">{i.qty}</span>
                  <button
                    type="button"
                    disabled={!canIncrease}
                    onClick={() => updateQty(i.productId, 1)}
                    className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="space-y-2 border-t border-amber-200 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 text-sm">Total a devolver</span>
            <span className="text-lg text-red-600">
              -${total.toLocaleString("es-AR")}
            </span>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={items.length === 0}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white py-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Confirmar e imprimir
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-100 rounded-xl p-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-700 text-sm">Comprobante de devolución</span>
              <button type="button" onClick={() => setPreview(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <TicketPreview
              ticket={preview}
              template={template}
              paperWidth={defaultPrinter?.paperWidth || 80}
            />
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg mt-3"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
