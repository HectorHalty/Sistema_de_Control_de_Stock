import { useState } from 'react';
import { Minus, Plus, Trash2, UserMinus } from 'lucide-react';
import { OrderItem } from './mockData';
import { useVentasPos } from './VentasPosContext';
import { PosProductPicker } from './PosProductPicker';

/**
 * Registrar consumo interno (empleado/operador) — Ventas, no Inventario.
 * Docs: docs/superpowers/plans/2026-09-08-consumo-como-venta.md.
 *
 * Mismo picker y mecánica de carrito que el Mostrador (PosProductPicker +
 * OrderItem[]), pero: no cobra (el ticket sale en $0, lo fuerza el
 * servidor), no imprime, y el motivo queda a mano en vez de elegir mesa.
 */
export function ConsumptionModule() {
  const { products, tickets, registerConsumption, setToast, saleBusy } = useVentasPos();
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [note, setNote] = useState('');

  const addToCart = (p: (typeof products)[number]) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === p.id);
      const nextQty = (existing?.qty ?? 0) + 1;
      if (nextQty > p.stock) {
        setToast(`Stock máximo para "${p.name}": ${p.stock}`);
        setTimeout(() => setToast(null), 2200);
        return prev;
      }
      if (existing) return prev.map(i => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(i => (i.productId === id ? { ...i, qty: i.qty + delta } : i)).filter(i => i.qty > 0),
    );
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.productId !== id));

  const itemCount = cart.reduce((s, i) => s + i.qty, 0);

  const submit = async () => {
    if (cart.length === 0 || saleBusy) return;
    const result = await registerConsumption(cart, note.trim() || undefined);
    if (!result) return;
    setToast(`✅ Consumo #${result.number} registrado (${itemCount} item(s))`);
    setTimeout(() => setToast(null), 3000);
    setCart([]);
    setNote('');
  };

  const recentConsumption = tickets.filter(t => t.kind === 'consumo').slice(0, 8);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <div className="flex min-h-0 flex-1 flex-col">
        <PosProductPicker
          products={products}
          onSelect={addToCart}
          listClassName="flex flex-1 flex-col gap-2 overflow-y-auto pb-24 lg:pb-2"
        />
      </div>

      <div className="lg:relative flex flex-col bg-card rounded-xl border border-border p-4 lg:w-96">
        <div className="mb-3 flex items-center gap-2">
          <UserMinus size={18} className="text-orange-600 dark:text-orange-400" />
          <h3 className="text-foreground">Registrar Consumo</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Descuenta stock según la receta del producto. No cobra ni imprime ticket.
        </p>

        <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[6rem]">
          {cart.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              Tocá productos para agregarlos
            </div>
          )}
          {cart.map(item => (
            <div key={item.productId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">{item.name}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.productId, -1)} className="rounded p-1 hover:bg-muted" aria-label="Restar">
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center text-sm">{item.qty}</span>
                <button onClick={() => updateQty(item.productId, 1)} className="rounded p-1 hover:bg-muted" aria-label="Sumar">
                  <Plus size={14} />
                </button>
                <button onClick={() => removeItem(item.productId)} className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" aria-label="Quitar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <label className="mb-1 block text-xs text-muted-foreground">Motivo (opcional)</label>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Ej: comida de personal, degustación..."
          className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />

        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Items</span>
          <span className="text-foreground">{itemCount}</span>
        </div>

        <button
          onClick={submit}
          disabled={cart.length === 0 || saleBusy}
          className="w-full rounded-lg bg-orange-600 py-2.5 text-white disabled:opacity-50"
        >
          {saleBusy ? 'Registrando…' : 'Registrar Consumo'}
        </button>

        {recentConsumption.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-xs text-muted-foreground">Últimos consumos</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {recentConsumption.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>#{t.number} · {t.items.reduce((s, i) => s + i.qty, 0)} item(s)</span>
                  <span>{t.createdAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
