import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { formatPrice } from '../cart/CartContext';
import { Button } from '../../ui/Button';
import { PageLoader } from '../../ui/PageLoader';

const STATUS_LABEL: Record<string, string> = {
  pendiente_pago: 'Pendiente de pago',
  pagado: 'Pagado',
  en_cocina: 'En cocina',
  listo: 'Listo para retirar',
  retirado: 'Retirado',
  cancelado: 'Cancelado',
};

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
      <div className="p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-8 text-center text-gray-400">
        <p>Iniciá sesión para ver tus pedidos.</p>
        <Button className="mt-4" onClick={() => navigate('/perfil')}>
          Ir al perfil
        </Button>
      </div>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <div>
        <h1 className="text-2xl font-black">Mis pedidos</h1>
        <p className="mt-1 text-sm text-gray-500">Pedidos de la cantina web.</p>
      </div>

      {!orders.length ? (
        <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-8 text-center text-gray-400">
          <p>Todavía no hiciste pedidos.</p>
          <Button className="mt-4" onClick={() => navigate('/cantina')}>
            Ir a la cantina
          </Button>
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-lch-accent">
                  Ticket #{order.ticketNumber ?? '—'}
                </p>
                <p className="mt-1 font-bold">{new Date(order.createdAt).toLocaleString('es-AR')}</p>
                <p className="text-sm text-gray-500">{STATUS_LABEL[order.status] ?? order.status}</p>
              </div>
              <p className="font-black text-lch-accent">{formatPrice(order.total)}</p>
            </div>
            <ul className="mt-3 space-y-1 border-t border-[#2a2a2a] pt-3 text-sm text-gray-400">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.quantity}× {item.name}
                </li>
              ))}
            </ul>
            {order.qr && !order.qr.usado && (
              <p className="mt-3 font-mono text-sm text-lch-accent">{order.qr.token}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
