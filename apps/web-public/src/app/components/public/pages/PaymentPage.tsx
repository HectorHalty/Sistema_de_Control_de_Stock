import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { useCart, formatPrice } from '../cart/CartContext';
import { Button } from '../../ui/Button';
import { LoginPanel } from '../auth/LoginPanel';

export function PaymentPage() {
  const navigate = useNavigate();
  const { user, token } = usePublicAuth();
  const { items, total, clear, setLastOrder } = useCart();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) {
    navigate('/carrito', { replace: true });
    return null;
  }

  async function handlePay() {
    if (!token) return;
    setProcessing(true);
    setError(null);
    try {
      const order = await publicApi.orders.checkout(
        items.map((i) => ({ salesProductId: i.id, quantity: i.qty })),
        token,
        `checkout-${Date.now()}`,
      );
      setLastOrder(order);
      clear();
      navigate('/qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el pedido');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <h1 className="text-2xl font-black">Confirmar pedido</h1>
      <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
        <p className="text-sm text-gray-400">
          Pago simulado — Mercado Pago se integrará en una fase posterior.
        </p>
        <ul className="mt-4 space-y-2 border-t border-[#2a2a2a] pt-4">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.qty}× {item.name}
              </span>
              <span className="font-semibold">{formatPrice(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-[#2a2a2a] pt-4 font-black">
          <span>Total</span>
          <span className="text-lch-accent">{formatPrice(total)}</span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {!user ? (
        <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
          <p className="mb-4 text-sm text-gray-400">
            Iniciá sesión para completar el pedido y obtener tu código QR de retiro.
          </p>
          <LoginPanel />
        </div>
      ) : (
        <Button className="w-full" disabled={processing} onClick={handlePay}>
          {processing ? 'Procesando...' : 'Confirmar pago (demo)'}
        </Button>
      )}
    </div>
  );
}
