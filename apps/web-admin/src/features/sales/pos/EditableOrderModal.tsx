import { useState } from "react";
import {
  Ban,
  Minus,
  Plus,
  Trash2,
  X,
  Save,
  ShoppingBag,
} from "lucide-react";
import type { OrderItem } from "./mockData";
import type { PosProduct, Ticket } from "./VentasPosContext";
import { PosProductPicker } from "./PosProductPicker";

type EditableOrderModalProps = {
  ticket: Ticket;
  products: PosProduct[];
  onClose: () => void;
  onSave: (ticketId: string, items: OrderItem[]) => Promise<Ticket | null> | Ticket | null;
  onVoid?: (ticketId: string) => Promise<Ticket | null>;
  setToast?: (msg: string | null) => void;
};

function maxQtyForProduct(product: PosProduct | undefined, qtyInOrder: number): number {
  if (!product) return qtyInOrder;
  return qtyInOrder + product.stock;
}

export function EditableOrderModal({
  ticket,
  products,
  onClose,
  onSave,
  onVoid,
  setToast,
}: EditableOrderModalProps) {
  const editable = ticket.status === "emitido" && ticket.kind === "venta";
  const [items, setItems] = useState<OrderItem[]>(() =>
    ticket.items.map((i) => ({ ...i })),
  );
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const updateQty = (productId: string, delta: number) => {
    setItems((prev) => {
      const product = products.find((p) => p.id === productId);
      return prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const next = i.qty + delta;
          const max = maxQtyForProduct(product, i.qty);
          if (next > max) {
            setToast?.(`Stock máximo: ${max} unidades`);
            return i;
          }
          return { ...i, qty: next };
        })
        .filter((i) => i.qty > 0);
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const addProduct = (p: PosProduct) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.productId === p.id);
      const nextQty = (ex?.qty ?? 0) + 1;
      if (nextQty > maxQtyForProduct(p, ex?.qty ?? 0)) {
        setToast?.(`Sin stock suficiente para "${p.name}"`);
        return prev;
      }
      if (ex) {
        return prev.map((i) =>
          i.productId === p.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [
        ...prev,
        { productId: p.id, name: p.name, price: p.price, qty: 1 },
      ];
    });
    setShowAddProduct(false);
  };

  const handleSave = async () => {
    if (!editable || items.length === 0) return;
    setSaving(true);
    const updated = await onSave(ticket.id, items);
    setSaving(false);
    if (updated) {
      setToast?.(`Pedido #${updated.number} actualizado`);
      onClose();
    }
  };

  const handleVoid = async () => {
    if (!onVoid || !editable) return;
    setVoiding(true);
    const v = await onVoid(ticket.id);
    setVoiding(false);
    if (v) {
      setToast?.(`Pedido #${v.number} anulado — stock reintegrado`);
      onClose();
    }
  };

  const statusLabel =
    ticket.status === "anulado"
      ? "Anulado"
      : ticket.kind === "devolucion"
        ? "Devolución"
        : "Emitido";

  const statusClass =
    ticket.status === "anulado"
      ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
      : ticket.kind === "devolucion"
        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
        : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ShoppingBag className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-semibold text-foreground">
                Pedido #{ticket.number}
              </h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ticket.createdAt} · {ticket.operator} · {ticket.source}
              {ticket.context ? ` · ${ticket.context}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Productos
          </p>

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {editable ? "Agregá productos al pedido" : "Sin ítems"}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                const emoji = product?.emoji ?? "📦";
                return (
                  <li
                    key={item.productId}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted p-3"
                  >
                    <span className="w-8 shrink-0 text-center text-xl">{emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${item.price.toLocaleString("es-AR")} c/u
                      </p>
                    </div>
                    {editable ? (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          ${(item.price * item.qty).toLocaleString("es-AR")}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQty(item.productId, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-semibold">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.productId, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-foreground">×{item.qty}</p>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">
                          ${(item.price * item.qty).toLocaleString("es-AR")}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {editable && (
            <div className="mt-3 border-t border-border pt-3">
              {!showAddProduct ? (
                <button
                  type="button"
                  onClick={() => setShowAddProduct(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300"
                >
                  <Plus className="h-4 w-4" />
                  Agregar producto
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Agregar al pedido
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddProduct(false)}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Ocultar
                    </button>
                  </div>
                  <PosProductPicker
                    products={products}
                    onSelect={addProduct}
                    listClassName="max-h-56 flex flex-col gap-2 overflow-y-auto pr-0.5"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-muted px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-muted-foreground">Total</span>
            <span
              className={`text-xl font-bold ${
                ticket.kind === "devolucion" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {ticket.kind === "devolucion" ? "-" : ""}$
              {total.toLocaleString("es-AR")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                Cerrar
              </button>
              {editable && onVoid && (
                <button
                  type="button"
                  onClick={handleVoid}
                  disabled={voiding}
                  className="flex-1 rounded-xl border border-red-200 dark:border-red-900 bg-card py-3 text-sm font-medium text-red-700 dark:text-red-300 transition hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Ban className="h-4 w-4" />
                    {voiding ? "…" : "Anular"}
                  </span>
                </button>
              )}
            </div>
            {editable && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || items.length === 0}
                className="ml-auto shrink-0 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando…" : "Guardar cambios"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
