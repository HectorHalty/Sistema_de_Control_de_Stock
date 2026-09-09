import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../../../api/public-api';
import { useCart, formatPrice } from '../cart/CartContext';
import { reconcileCart } from '../cart/reconcile-cart';
import { foodImageFor } from '../food-images';
import { SafeImage } from '../SafeImage';

export function CartPage() {
  const navigate = useNavigate();
  const { items, total, add, remove, replaceItems } = useCart();

  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: () => publicApi.menu() });

  useEffect(() => {
    if (!menu) return;
    const ids = new Set(menu.items.map((i) => i.id));
    const { kept, removedNames } = reconcileCart(items, ids);
    if (removedNames.length) {
      replaceItems(kept);
      window.alert('Se quitaron productos que ya no están disponibles.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

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
              <SafeImage
                src={item.imageUrl ?? foodImageFor(item.name, item.category)}
                alt={item.name}
                className="h-full w-full"
                fallbackLabel={item.name}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 font-bold text-white">{item.name}</p>
              {item.description && (
                <p className="line-clamp-1 text-xs text-gray-500">{item.description}</p>
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
        <div
          style={{ borderTop: '1px solid #2a2a2a' }}
          className="mt-3 flex items-center justify-between pt-3"
        >
          <span className="font-black text-lch-accent">Total</span>
          <span className="text-xl font-black text-lch-accent">{formatPrice(total)}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/pago')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-3.5 text-sm font-black text-[#0e0e0e]"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
