import { ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart, formatPrice } from '../cart/CartContext';
import { foodImageFor } from '../food-images';

export function CartPage() {
  const navigate = useNavigate();
  const { items, total, add, remove } = useCart();
  const serviceFee = 0;

  if (!items.length) {
    return (
      <div className="space-y-4 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate('/cantina')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={16} />
          Volver al menú
        </button>
        <div
          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
          className="rounded-2xl p-10 text-center text-gray-400"
        >
          <p className="font-semibold text-white">Tu carrito está vacío</p>
          <button
            type="button"
            onClick={() => navigate('/cantina')}
            className="mt-4 rounded-xl bg-lch-accent px-6 py-3 text-sm font-black text-[#0e0e0e]"
          >
            Ver menú
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate('/cantina')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white"
      >
        <ArrowLeft size={16} />
        Volver al menú
      </button>

      <h1 className="text-2xl font-black text-white">Tu Carrito</h1>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
            className="flex items-center gap-4 rounded-xl px-4 py-4"
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#161616]">
              <img
                src={item.imageUrl ?? foodImageFor(item.name, item.category)}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white">{item.name}</p>
              {item.description && (
                <p className="truncate text-xs text-gray-500">{item.description}</p>
              )}
            </div>
            <p className="shrink-0 font-black text-[#6BFF9E]">{formatPrice(item.price * item.qty)}</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => remove(item.id)}
                style={{ background: '#252525', border: '1px solid #3a3a3a' }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
              >
                -
              </button>
              <span className="w-5 text-center text-sm font-bold">{item.qty}</span>
              <button
                type="button"
                onClick={() => add(item)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-lch-accent font-bold text-[#0e0e0e]"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="rounded-xl p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Subtotal</span>
          <span className="text-white">{formatPrice(total)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-gray-400">Costo de Servicio</span>
          <span className="text-white">{formatPrice(serviceFee)}</span>
        </div>
        <div
          style={{ borderTop: '1px solid #2a2a2a' }}
          className="mt-3 flex items-center justify-between pt-3"
        >
          <span className="font-black text-lch-accent">Total</span>
          <span className="text-xl font-black text-lch-accent">{formatPrice(total + serviceFee)}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/pago')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-3.5 text-sm font-black text-[#0e0e0e]"
        >
          <Lock size={16} />
          Proceder al Pago Seguro
        </button>
      </div>
    </div>
  );
}
