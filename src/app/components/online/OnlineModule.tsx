import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useAppContext } from '../AppContext';
import { initialSalesMenu } from '../sales/data';
import type { SalesOrderItem } from '../sales/types';
import { checkoutOnlineOrder } from './domain';

interface OnlineOrder {
  id: string;
  createdAtISO: string;
  status: 'pendiente' | 'confirmado';
  channel: 'Web' | 'App';
  items: SalesOrderItem[];
  total: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

export function OnlineModule() {
  const { products, setProducts, currentUser, addAudit } = useAppContext();
  const [searchParams] = useSearchParams();
  const tabKey = searchParams.get('tab');
  const tab = (tabKey === 'catalogo' || tabKey === 'carrito' || tabKey === 'pedidos' || tabKey === 'integracion' ? tabKey : 'resumen') as
    | 'resumen'
    | 'catalogo'
    | 'carrito'
    | 'pedidos'
    | 'integracion';
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<SalesOrderItem[]>([]);
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [message, setMessage] = useState('');

  const menu = initialSalesMenu.filter(item => item.active);

  const filteredMenu = menu.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
  const total = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  const metrics = useMemo(() => {
    const confirmed = orders.filter(order => order.status === 'confirmado');
    const revenue = confirmed.reduce((sum, order) => sum + order.total, 0);
    return {
      totalOrders: orders.length,
      pendingOrders: orders.filter(order => order.status === 'pendiente').length,
      confirmedRevenue: revenue,
    };
  }, [orders]);

  const addToCart = (productId: string) => {
    const menuProduct = menu.find(item => item.id === productId);
    if (!menuProduct) return;

    setCart(prev => {
      const existing = prev.find(item => item.menuProductId === menuProduct.id);
      if (existing) {
        return prev.map(item =>
          item.menuProductId === menuProduct.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...prev,
        {
          menuProductId: menuProduct.id,
          name: menuProduct.name,
          unitPrice: menuProduct.price,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (id: string, next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    setCart(prev => prev.map(item => (item.menuProductId === id ? { ...item, quantity: Math.floor(next) } : item)));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.menuProductId !== id));

  const createOnlineOrder = () => {
    if (cart.length === 0) {
      setMessage('Agregá productos al carrito para generar el pedido online.');
      return;
    }

    const result = checkoutOnlineOrder(cart, menu, products);
    if (!result.ok) {
      setMessage(`No se puede confirmar. Stock insuficiente: ${result.missingSummary}`);
      return;
    }

    setProducts(result.updatedProducts);
    const newOrder: OnlineOrder = {
      id: `on-${Date.now()}`,
      createdAtISO: new Date().toISOString(),
      status: 'confirmado',
      channel: Math.random() > 0.5 ? 'Web' : 'App',
      items: cart,
      total,
    };

    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    setMessage(`Pedido online confirmado (${newOrder.channel}) por ${formatCurrency(newOrder.total)}.`);

    addAudit({
      user: currentUser.username,
      action: `Venta Online #${newOrder.id}`,
      element: 'Pedidos Online',
      previousValue: '-',
      newValue: `${newOrder.items.length} item(s)`,
    });
  };

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-foreground">Ventas Online</h2>
        <p className="text-sm text-muted-foreground">Backoffice interno para pedidos web/app de clientes (canal separado de administración).</p>
      </header>

      {message && <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">{message}</div>}

      {tab === 'resumen' && (
        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Pedidos Totales</p><p className="text-2xl">{metrics.totalOrders}</p></article>
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Pendientes</p><p className="text-2xl">{metrics.pendingOrders}</p></article>
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Facturación Confirmada</p><p className="text-2xl">{formatCurrency(metrics.confirmedRevenue)}</p></article>
        </section>
      )}

      {tab === 'catalogo' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar producto de venta online..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#2d5fa8]"
          />
          <div className="grid gap-2 md:grid-cols-2">
            {filteredMenu.map(item => (
              <button key={item.id} onClick={() => addToCart(item.id)} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-left hover:border-[#2d5fa8]">
                <span><span className="mr-2">{item.emoji}</span>{item.name}</span>
                <span className="text-sm text-[#2d5fa8]">{formatCurrency(item.price)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === 'carrito' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          {cart.length === 0 && <p className="text-sm text-muted-foreground">No hay items en el carrito.</p>}
          {cart.map(item => (
            <article key={item.menuProductId} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
              <div>
                <p className="text-sm text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={event => updateQuantity(item.menuProductId, Number(event.target.value))}
                  className="w-16 rounded-lg border border-border px-2 py-1"
                />
                <button onClick={() => removeFromCart(item.menuProductId)} className="rounded-lg border border-border px-2 py-1 text-xs">Quitar</button>
              </div>
            </article>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <p>Total</p>
            <p style={{ fontWeight: 700 }}>{formatCurrency(total)}</p>
          </div>
          <button onClick={createOnlineOrder} className="w-full rounded-xl bg-[#2d5fa8] py-2.5 text-sm text-white hover:bg-[#244d8a]">Confirmar pedido online</button>
        </section>
      )}

      {tab === 'pedidos' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
          {orders.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay pedidos online.</p>}
          {orders.map(order => (
            <article key={order.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground">Pedido {order.id}</p>
                <span className="rounded-full bg-[#2d5fa8]/10 px-2 py-0.5 text-xs text-[#2d5fa8]">{order.channel}</span>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(order.createdAtISO).toLocaleString('es-AR')} • {formatCurrency(order.total)}</p>
            </article>
          ))}
        </section>
      )}

      {tab === 'integracion' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-[#2d5fa8]" size={18} />
            <div>
              <h3 className="text-foreground">Arquitectura de seguridad prevista</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>Este módulo es solo backoffice interno ERP (web + APK interna).</li>
                <li>Clientes usarán frontend externo separado (web + apps store), sin compartir vistas de administración.</li>
                <li>La lógica de stock es común para evitar inconsistencias entre venta física y online.</li>
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
