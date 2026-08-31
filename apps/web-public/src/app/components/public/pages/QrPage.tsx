import { QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart, formatPrice } from '../cart/CartContext';
import { Button } from '../../ui/Button';

export function QrPage() {
  const navigate = useNavigate();
  const { lastOrder } = useCart();

  if (!lastOrder?.qr) {
    return (
      <div className="p-6" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-8 text-center">
        <p className="text-gray-400">No hay pedido activo.</p>
        <Button className="mt-4" onClick={() => navigate('/cantina')}>
          Ir a la cantina
        </Button>
      </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 p-6 text-center">
      <div className="rounded-2xl border border-lch-accent/30 bg-lch-card p-6">
        <p className="text-xs font-black uppercase tracking-widest text-lch-accent">
          Pedido #{lastOrder.ticketNumber ?? '—'}
        </p>
        <h2 className="mt-2 text-xl font-black">Mostrá este código en cantina</h2>
        <div className="mx-auto my-6 flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-lch-accent/40 bg-[#161616]">
          <QrCode size={120} className="text-lch-accent" strokeWidth={1} />
        </div>
        <p className="font-mono text-lg font-black tracking-wider text-lch-accent">
          {lastOrder.qr.token}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Token único de un solo uso. El staff lo escanea en Online → Escáner QR.
        </p>
      </div>

      <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5 text-left">
        <p className="font-bold">Resumen</p>
        <ul className="mt-3 space-y-1 text-sm text-gray-400">
          {lastOrder.items.map((item) => (
            <li key={item.id}>
              {item.quantity}× {item.name} — {formatPrice(item.unitPrice * item.quantity)}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-black text-lch-accent">Total: {formatPrice(lastOrder.total)}</p>
        <p className="mt-2 text-xs text-gray-500">Estado: {lastOrder.status}</p>
      </div>

      <Button variant="secondary" className="w-full" onClick={() => navigate('/pedidos')}>
        Ver mis pedidos
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
        Volver al inicio
      </Button>
    </div>
  );
}
