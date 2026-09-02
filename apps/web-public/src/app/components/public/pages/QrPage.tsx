import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicApi, type PublicOrder } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { useCart, formatPrice } from '../cart/CartContext';
import { Button } from '../../ui/Button';
import { PageLoader } from '../../ui/PageLoader';

export function QrPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { token } = usePublicAuth();
  const { lastOrder, setLastOrder } = useCart();
  const [displayOrder, setDisplayOrder] = useState<PublicOrder | null>(lastOrder);

  const { data: fetched, isLoading } = useQuery({
    queryKey: ['public-order-qr', orderId, token],
    queryFn: () => publicApi.orders.get(orderId!, token!),
    enabled: !!orderId && !!token,
  });

  useEffect(() => {
    if (fetched) {
      setDisplayOrder(fetched);
      setLastOrder(fetched);
    } else if (lastOrder) {
      setDisplayOrder(lastOrder);
    }
  }, [fetched, lastOrder, setLastOrder]);

  if (isLoading) return <PageLoader />;

  if (!displayOrder?.qr) {
    return (
      <div className="p-6" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div
          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
          className="rounded-2xl p-8 text-center"
        >
          <p className="text-gray-400">No hay pedido activo con codigo QR.</p>
          <Button className="mt-4" onClick={() => navigate('/cantina')}>
            Ir a la cantina
          </Button>
        </div>
      </div>
    );
  }

  const qrPayload = displayOrder.qr.token;

  return (
    <div className="mx-auto max-w-md space-y-5 p-6 text-center">
      <div
        style={{ background: '#1c1c1c', border: '1px solid #6BFF9E44' }}
        className="rounded-2xl p-6"
      >
        <p className="text-xs font-black uppercase tracking-widest text-lch-accent">
          Orden #{displayOrder.ticketNumber ?? displayOrder.id.slice(0, 8).toUpperCase()}
        </p>
        <h2 className="mt-2 text-xl font-black text-[#6BFF9E]">Tu código de retiro está listo</h2>
        <p className="mt-1 text-sm text-gray-500">
          Presentalo en la cantina cuando quieras buscar tu pedido.
        </p>

        <div className="mx-auto my-6 flex w-fit items-center justify-center rounded-2xl border-2 border-dashed border-lch-accent/40 bg-white p-4">
          <QRCodeSVG
            value={qrPayload}
            size={200}
            level="M"
            includeMargin
            bgColor="#ffffff"
            fgColor="#0e0e0e"
          />
        </div>

        <p className="font-mono text-lg font-black tracking-wider text-lch-accent">{qrPayload}</p>
        <p className="mt-2 text-xs text-gray-500">
          Token unico de un solo uso. El staff lo escanea en Online - Cocina.
        </p>
        {displayOrder.qr.usado && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-400">
            Este codigo ya fue utilizado.
          </p>
        )}
      </div>

      <div
        style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
        className="rounded-2xl p-5 text-left"
      >
        <p className="font-bold text-white">Productos Comprados</p>
        <ul className="mt-3 space-y-2 text-sm">
          {displayOrder.items.map((item) => (
            <li key={item.id} className="flex justify-between text-gray-300">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span>{item.unitPrice === 0 ? 'Gratis' : formatPrice(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between text-base font-black text-lch-accent">
          <span>Total</span>
          <span>{formatPrice(displayOrder.total)}</span>
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate('/pedidos')}
        className="w-full rounded-xl bg-lch-accent py-3.5 text-sm font-black text-[#0e0e0e]"
      >
        Ver todos mis pedidos
      </button>
      <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
        Volver al inicio
      </Button>
    </div>
  );
}
