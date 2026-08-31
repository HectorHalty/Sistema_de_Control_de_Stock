import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart, formatPrice } from '../cart/CartContext';
import { Button } from '../../ui/Button';
import { foodImageFor } from '../food-images';

export function CartPage() {
  const navigate = useNavigate();
  const { items, total, add, remove } = useCart();

  if (!items.length) {
    return (
      <div className="space-y-4 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate('/cantina')}
          className="inline-flex items-center gap-1 text-sm font-bold text-lch-accent"
        >
          <ArrowLeft size={16} />
          Volver al menú
        </button>
        <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-8 text-center text-gray-400">
          <p className="font-semibold">Tu carrito está vacío.</p>
          <Button className="mt-4" onClick={() => navigate('/cantina')}>
            Ver menú
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate('/cantina')}
        className="inline-flex items-center gap-1 text-sm font-bold text-lch-accent"
      >
        <ArrowLeft size={16} />
        Seguir comprando
      </button>

      <h1 className="text-2xl font-black">Carrito</h1>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 rounded-2xl border border-[#2a2a2a] bg-lch-card px-4 py-4"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#161616]">
              <img
                src={foodImageFor(item.name, item.category)}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{item.name}</p>
              <p className="text-sm text-gray-500">{formatPrice(item.price)} c/u</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="h-8 w-8 rounded-lg border border-[#2a2a2a] bg-[#252525]"
              >
                −
              </button>
              <span className="w-6 text-center font-bold">{item.qty}</span>
              <button
                type="button"
                onClick={() => add(item)}
                className="h-8 w-8 rounded-lg bg-lch-accent font-bold text-[#0e0e0e]"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-lch-accent/30 bg-lch-card p-5">
        <div className="flex items-center justify-between">
          <span className="font-bold">Total</span>
          <span className="text-xl font-black text-lch-accent">{formatPrice(total)}</span>
        </div>
        <Button className="mt-4 w-full" onClick={() => navigate('/pago')}>
          Ir a pagar
        </Button>
      </div>
    </div>
  );
}
