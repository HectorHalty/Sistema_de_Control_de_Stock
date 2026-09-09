import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { useCart, formatPrice } from '../cart/CartContext';
import { AuthForm } from '../auth/AuthForm';
import { SafeImage } from '../SafeImage';

export function PaymentPage() {
  const navigate = useNavigate();
  const { user, token } = usePublicAuth();
  const { items, total, clear, setLastOrder } = useCart();
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!items.length && !confirmed) {
    navigate('/carrito', { replace: true });
    return null;
  }

  async function handleConfirm() {
    if (!token) return;
    setProcessing(true);
    setError(null);
    try {
      const order = await publicApi.orders.checkout(
        items.map((i) => ({ salesProductId: i.id, quantity: i.qty })),
        token,
        `checkout-${Date.now()}`,
      );
      setConfirmed(true);
      setLastOrder(order);
      navigate('/qr');
      clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el pedido');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="mx-auto space-y-5 p-6" style={{ maxWidth: 720 }}>
      <button
        type="button"
        onClick={() => navigate('/carrito')}
        className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white"
      >
        ← Volver al carrito
      </button>
      <h1 className="text-2xl font-black text-white">Confirmar pedido</h1>

      {!user ? (
        <div className="rounded-xl border border-[#2a2a2a] bg-lch-card p-5">
          <p className="mb-4 text-sm text-gray-400">
            Necesitás una cuenta para confirmar el pedido y recibir tu código QR de retiro. Podés armar el carrito sin registrarte.
          </p>
          <AuthForm />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1c1c1c]">
            <div className="border-b border-[#2a2a2a] px-5 py-4">
              <h2 className="font-bold text-white">Resumen del pedido</h2>
            </div>
            {items.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4"
                style={{ borderBottom: i < items.length - 1 ? '1px solid #2a2a2a' : 'none' }}
              >
                <SafeImage
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-14 w-14 shrink-0 rounded-lg"
                  fallbackLabel={item.emoji ?? '🍽'}
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-white">{item.name}</p>
                  <span className="mt-1 inline-block rounded bg-[#2a2a2a] px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                    Cant: {item.qty}
                  </span>
                </div>
                <span className="text-sm font-bold text-white">
                  {item.price === 0 ? 'Gratis' : formatPrice(item.price * item.qty)}
                </span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-4">
              <span className="text-base font-black text-lch-accent">Total</span>
              <span className="text-base font-black text-lch-accent">{formatPrice(total)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-5 text-sm text-gray-300">
            <p className="font-bold text-white">Pagás al retirar</p>
            <p className="mt-1 text-gray-400">
              El pago se hace en el mostrador de la cantina cuando retirás el pedido. Te vamos a dar
              un código QR para mostrar al llegar.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleConfirm()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-3.5 text-sm font-black text-[#0e0e0e] disabled:opacity-50"
          >
            {processing ? 'Confirmando...' : 'Confirmar pedido'}
          </button>
        </>
      )}
    </div>
  );
}
