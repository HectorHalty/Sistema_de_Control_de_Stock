import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { AuthForm } from '../auth/AuthForm';
import { formatPrice } from '../cart/CartContext';
import { PageLoader } from '../../ui/PageLoader';

const STATUS_LABEL: Record<string, string> = {
  pendiente_pago: 'Pendiente de pago',
  pagado: 'Pagado',
  en_cocina: 'En preparacion',
  listo: 'Listo para retirar',
  retirado: 'Retirado',
  cancelado: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  listo: '#6BFF9E',
  en_cocina: '#fbbf24',
  retirado: '#9ca3af',
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (sameDay) return 'Hoy';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { token, user } = usePublicAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['public-orders', token],
    queryFn: () => publicApi.orders.list(token!),
    enabled: !!token,
  });

  if (!user || !token) {
    return (
      <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-lch-accent">Cantina</p>
          <h1 className="text-2xl font-black text-white">Mis Pedidos</h1>
        </div>
        <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="rounded-2xl p-5">
          <p className="mb-4 text-sm text-gray-400">Inicia sesion para ver tus pedidos de cantina.</p>
          <AuthForm />
        </div>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-lch-accent">Cantina</p>
        <h1 className="text-2xl font-black text-white">Mis Pedidos</h1>
        <p className="mt-1 text-sm text-gray-500">Historial de pedidos web.</p>
      </div>

      {!orders.length ? (
        <div
          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
          className="rounded-2xl p-10 text-center text-gray-400"
        >
          <p>Todavia no hiciste pedidos.</p>
          <button
            type="button"
            onClick={() => navigate('/cantina')}
            className="mt-4 rounded-xl bg-lch-accent px-6 py-3 text-sm font-black text-[#0e0e0e]"
          >
            Ir a la cantina
          </button>
        </div>
      ) : (
        orders.map((order, index) => {
          const statusColor = STATUS_COLOR[order.status] ?? '#9ca3af';
          const canShowQr = order.qr && !order.qr.usado && order.status !== 'retirado';
          return (
            <div
              key={order.id}
              style={{
                background: '#1c1c1c',
                border: index === 0 && canShowQr ? '1px solid #6BFF9E44' : '1px solid #2a2a2a',
              }}
              className="rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-lch-accent">
                    Ticket #{order.ticketNumber ?? '-'}
                  </p>
                  <p className="mt-1 font-bold text-white">{formatWhen(order.createdAt)}</p>
                  <p className="text-sm font-semibold" style={{ color: statusColor }}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </p>
                </div>
                <p className="font-black text-lch-accent">{formatPrice(order.total)}</p>
              </div>
              <ul className="mt-3 space-y-1 border-t border-[#2a2a2a] pt-3 text-sm text-gray-400">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}x {item.name}
                  </li>
                ))}
              </ul>
              {canShowQr && (
                <button
                  type="button"
                  onClick={() => navigate(`/qr?orderId=${order.id}`)}
                  className="mt-4 w-full rounded-xl bg-lch-accent py-2.5 text-sm font-black text-[#0e0e0e]"
                >
                  Ver codigo QR
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
