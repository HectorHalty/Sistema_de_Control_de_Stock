import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { useCart, formatPrice } from '../cart/CartContext';
import { AuthForm } from '../auth/AuthForm';

const inputStyle = {
  background: '#242424',
  border: '1px solid #3a3a3a',
  color: 'white',
};

export function PaymentPage() {
  const navigate = useNavigate();
  const { user, token } = usePublicAuth();
  const { items, total, clear, setLastOrder } = useCart();
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState(user?.nombre ?? '');
  const [postal, setPostal] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) {
    navigate('/carrito', { replace: true });
    return null;
  }

  const serviceFee = 0;
  const grandTotal = total + serviceFee;

  async function handlePay() {
    if (!token) return;
    if (cardNum.replace(/\D/g, '').length < 13) {
      setError('Ingresá un número de tarjeta válido');
      return;
    }
    if (!cardName.trim()) {
      setError('Ingresá el nombre en la tarjeta');
      return;
    }

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
    <div className="mx-auto space-y-5 p-6" style={{ maxWidth: 960 }}>
      <button
        type="button"
        onClick={() => navigate('/carrito')}
        className="mb-1 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white"
      >
        ← Volver al carrito
      </button>
      <h1 className="text-2xl font-black text-white">Pago Seguro</h1>

      {!user ? (
        <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
          <p className="mb-4 text-sm text-gray-400">
            Iniciá sesión o registrate para completar el pedido y obtener tu código QR de retiro.
          </p>
          <AuthForm />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1c1c1c]">
              <div className="border-b border-[#2a2a2a] px-5 py-4">
                <h2 className="font-bold text-white">Resumen del Pedido</h2>
              </div>
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4"
                  style={{ borderBottom: i < items.length - 1 ? '1px solid #2a2a2a' : 'none' }}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#242424] text-2xl">
                      {item.emoji ?? '🍽'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <span className="mt-1 inline-block rounded bg-[#2a2a2a] px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                      Cant: {item.qty}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {item.price === 0 ? 'Gratis' : formatPrice(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white">{formatPrice(total)}</span>
              </div>
              {serviceFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Costo de servicio</span>
                  <span className="text-white">{formatPrice(serviceFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#2a2a2a] pt-2">
                <span className="text-base font-black text-lch-accent">Total</span>
                <span className="text-base font-black text-lch-accent">{formatPrice(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="space-y-4 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-5">
              <h2 className="font-bold text-white">Método de Pago</h2>
              <button
                type="button"
                style={{ border: '1px solid #3a3a3a' }}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
              >
                Pagar con Billetera Digital
              </button>
              <p className="text-xs text-gray-500">
                Simulación — Mercado Pago se integrará más adelante. No se guardan datos de tarjeta.
              </p>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#2a2a2a]" />
                <span className="text-xs text-gray-600">o pagar con tarjeta</span>
                <div className="h-px flex-1 bg-[#2a2a2a]" />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-400">Número de tarjeta</label>
                  <input
                    style={inputStyle}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors focus:border-lch-accent"
                    placeholder="1234 5678 9012 3456"
                    value={cardNum}
                    onChange={(e) => setCardNum(e.target.value.replace(/\D/g, '').slice(0, 16))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-400">Vencimiento</label>
                    <input
                      style={inputStyle}
                      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-lch-accent"
                      placeholder="MM/AA"
                      value={expiry}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setExpiry(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-400">CVC</label>
                    <input
                      style={inputStyle}
                      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-lch-accent"
                      placeholder="123"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-400">Nombre en la tarjeta</label>
                  <input
                    style={inputStyle}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-lch-accent"
                    placeholder="Como figura en la tarjeta"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-400">
                    Código Postal de Facturación
                  </label>
                  <input
                    style={inputStyle}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-lch-accent"
                    placeholder="C1000"
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
              )}

              <button
                type="button"
                disabled={processing}
                onClick={() => void handlePay()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-3.5 text-sm font-black text-[#0e0e0e] disabled:opacity-50"
              >
                {processing ? 'Procesando pago...' : `Pagar ${formatPrice(grandTotal)}`}
              </button>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-xs leading-relaxed text-gray-600">
              Protegido por cifrado de 256 bits
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
