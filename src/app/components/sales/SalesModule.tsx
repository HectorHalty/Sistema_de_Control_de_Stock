import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useAppContext } from '../AppContext';
import { initialSalesMenu } from './data';
import { applyStockDeduction, buildRequiredByStockProduct, validateStockForOrder } from './domain';
import type { SalesMenuProduct, SalesOrderItem, SalesTicket } from './types';

type SalesTab = 'inicio' | 'caja' | 'pedidos' | 'devoluciones' | 'productos' | 'mesas' | 'metricas' | 'reportes' | 'historial';

function useLocalState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const update = (next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = next instanceof Function ? next(prev) : next;
      localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  };

  return [value, update] as const;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

function restoreStock(
  products: ReturnType<typeof useAppContext>['products'],
  requiredByStockProduct: Record<string, number>,
) {
  return products.map(product => {
    const restoreQty = requiredByStockProduct[product.id] || 0;
    if (restoreQty <= 0) return product;
    if (product.stockByWarehouse.length === 0) return product;

    return {
      ...product,
      stockByWarehouse: product.stockByWarehouse.map((warehouseStock, index) =>
        index === 0
          ? { ...warehouseStock, quantity: warehouseStock.quantity + restoreQty }
          : warehouseStock,
      ),
    };
  });
}

export function SalesModule() {
  const { products, setProducts, currentUser, addAudit } = useAppContext();
  const [searchParams] = useSearchParams();

  const currentTab = searchParams.get('tab');
  const tab = (currentTab === 'caja' || currentTab === 'pedidos' || currentTab === 'devoluciones' || currentTab === 'productos' || currentTab === 'mesas' || currentTab === 'metricas' || currentTab === 'reportes' || currentTab === 'historial'
    ? currentTab
    : 'inicio') as SalesTab;
  const [menu] = useLocalState<SalesMenuProduct[]>('sales-menu-products', initialSalesMenu);
  const [tickets, setTickets] = useLocalState<SalesTicket[]>('sales-tickets', []);
  const [counter, setCounter] = useLocalState<number>('sales-ticket-counter', 1000);
  const [cart, setCart] = useState<SalesOrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todas' | SalesMenuProduct['category']>('Todas');
  const [message, setMessage] = useState('');

  const categories = ['Todas', ...Array.from(new Set(menu.map(item => item.category)))] as const;

  const stockNameById = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach(product => {
      map[product.id] = product.name;
    });
    return map;
  }, [products]);

  const filteredProducts = menu.filter(item => {
    const categoryMatch = categoryFilter === 'Todas' || categoryFilter === item.category;
    const searchMatch = item.name.toLowerCase().includes(search.toLowerCase());
    return item.active && categoryMatch && searchMatch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const metrics = useMemo(() => {
    const issuedTickets = tickets.filter(ticket => ticket.status === 'emitido');
    const totalSales = issuedTickets.reduce((sum, ticket) => sum + ticket.total, 0);
    const totalItems = issuedTickets.reduce((sum, ticket) => sum + ticket.items.reduce((acc, item) => acc + item.quantity, 0), 0);

    const byProduct: Record<string, number> = {};
    issuedTickets.forEach(ticket => {
      ticket.items.forEach(item => {
        byProduct[item.name] = (byProduct[item.name] || 0) + item.quantity;
      });
    });

    const topProducts = Object.entries(byProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { totalSales, totalItems, topProducts };
  }, [tickets]);

  const addToCart = (menuProduct: SalesMenuProduct) => {
    setCart(prev => {
      const current = prev.find(item => item.menuProductId === menuProduct.id);
      if (current) {
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

  const updateQuantity = (menuProductId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item =>
          item.menuProductId === menuProductId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter(item => item.quantity > 0),
    );
  };

  const checkout = () => {
    if (cart.length === 0) {
      setMessage('Agregá productos para registrar la venta.');
      return;
    }

    const validation = validateStockForOrder(cart, menu, products);
    if (!validation.ok) {
      const missingText = validation.missing
        .map(item => `${stockNameById[item.stockProductId] || item.stockProductId} (${item.available}/${item.required})`)
        .join(', ');
      setMessage(`No hay stock suficiente: ${missingText}.`);
      return;
    }

    const nextCounter = counter + 1;
    const newTicket: SalesTicket = {
      id: `sale-${Date.now()}`,
      number: nextCounter,
      createdAtISO: new Date().toISOString(),
      status: 'emitido',
      items: cart,
      total: cartTotal,
      note: `Operador: ${currentUser.username}`,
    };

    setProducts(prev => applyStockDeduction(prev, validation.requiredByStockProduct));
    setTickets(prev => [newTicket, ...prev]);
    setCounter(nextCounter);
    setCart([]);
    setMessage(`Venta registrada (#${newTicket.number}) por ${formatCurrency(newTicket.total)}.`);

    addAudit({
      user: currentUser.username,
      action: `Venta registrada #${newTicket.number}`,
      element: `Ticket ${newTicket.number}`,
      previousValue: '-',
      newValue: `${newTicket.items.length} item(s)`,
    });
  };

  const handleReturn = (ticket: SalesTicket) => {
    if (ticket.status === 'anulado') return;

    const required = buildRequiredByStockProduct(ticket.items, menu);
    setProducts(prev => restoreStock(prev, required));
    setTickets(prev => prev.map(item => (item.id === ticket.id ? { ...item, status: 'anulado' } : item)));
    setMessage(`Devolución aplicada sobre ticket #${ticket.number}. Stock reintegrado.`);

    addAudit({
      user: currentUser.username,
      action: `Devolución ticket #${ticket.number}`,
      element: `Ticket ${ticket.number}`,
      previousValue: 'emitido',
      newValue: 'anulado',
    });
  };

  return (
    <div className="space-y-4">
      <section className="space-y-4">
        {message && <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">{message}</div>}

        {tab === 'inicio' && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Ventas del día</p>
              <p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{formatCurrency(metrics.totalSales)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Tickets emitidos</p>
              <p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{tickets.filter(ticket => ticket.status === 'emitido').length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Items vendidos</p>
              <p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{metrics.totalItems}</p>
            </div>
          </div>
        )}

        {tab === 'caja' && (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row">
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 outline-none focus:border-[#3d7a3d]"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={event => setCategoryFilter(event.target.value as 'Todas' | SalesMenuProduct['category'])}
                  className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#3d7a3d]"
                >
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors hover:border-[#3d7a3d]"
                  >
                    <span className="text-2xl">{product.emoji}</span>
                    <span className="flex-1">
                      <span className="block text-sm text-foreground" style={{ fontWeight: 600 }}>{product.name}</span>
                      <span className="text-xs text-muted-foreground">{product.category} • {product.station}</span>
                    </span>
                    <span className="text-sm text-[#2f5f2f]">{formatCurrency(product.price)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-foreground">Comanda actual</h3>
              <div className="space-y-2">
                {cart.length === 0 && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Todavía no hay productos agregados.</p>}
                {cart.map(item => (
                  <div key={item.menuProductId} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
                    <div>
                      <p className="text-sm text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.menuProductId, -1)} className="h-7 w-7 rounded-lg border border-border">-</button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.menuProductId, 1)} className="h-7 w-7 rounded-lg border border-border">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-xl text-foreground" style={{ fontWeight: 700 }}>{formatCurrency(cartTotal)}</span>
                </div>
                <button onClick={checkout} className="w-full rounded-xl bg-[#3d7a3d] py-2.5 text-sm text-white transition-colors hover:bg-[#2f5f2f]">
                  Confirmar venta
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'pedidos' && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-foreground">Mis Pedidos</h3>
            <div className="space-y-2">
              {tickets.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay pedidos registrados.</p>}
              {tickets.filter(ticket => ticket.status === 'emitido').map(ticket => (
                <article key={ticket.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Ticket #{ticket.number}</p>
                    <p className="text-sm text-[#2f5f2f]">{formatCurrency(ticket.total)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(ticket.createdAtISO).toLocaleString('es-AR')}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === 'devoluciones' && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-foreground">Devoluciones</h3>
            <div className="space-y-2">
              {tickets.length === 0 && <p className="text-sm text-muted-foreground">No hay tickets para devolver.</p>}
              {tickets.map(ticket => (
                <div key={ticket.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                  <div>
                    <p className="text-sm text-foreground">Ticket #{ticket.number}</p>
                    <p className="text-xs text-muted-foreground">Estado: {ticket.status}</p>
                  </div>
                  <button
                    onClick={() => handleReturn(ticket)}
                    disabled={ticket.status === 'anulado'}
                    className="rounded-xl border border-border px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
                  >
                    Devolver
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'productos' && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-foreground">Productos POS y recetas</h3>
            <div className="space-y-2">
              {menu.map(product => (
                <article key={product.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(product.price)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Receta: {product.recipe.map(item => `${stockNameById[item.stockProductId] || item.stockProductId} x${item.quantity}`).join(' · ')}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === 'mesas' && (
          <div className="grid gap-3 md:grid-cols-3">
            {['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6'].map((mesa, index) => (
              <article key={mesa} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-foreground">{mesa}</p>
                <p className={`mt-1 text-sm ${index % 2 === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{index % 2 === 0 ? 'Libre' : 'Ocupada'}</p>
              </article>
            ))}
          </div>
        )}

        {tab === 'metricas' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-foreground">Top productos</h3>
              <div className="space-y-2">
                {metrics.topProducts.length === 0 && <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>}
                {metrics.topProducts.map(([name, sold]) => (
                  <div key={name} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                    <span className="text-sm text-foreground">{name}</span>
                    <span className="text-sm text-[#2f5f2f]">{sold} uds</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-foreground">Resumen</h3>
              <p className="text-sm text-muted-foreground">Ventas acumuladas</p>
              <p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{formatCurrency(metrics.totalSales)}</p>
            </article>
          </div>
        )}

        {tab === 'reportes' && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-foreground">Reportes rápidos</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Ventas del día: {formatCurrency(metrics.totalSales)}</li>
              <li>• Tickets activos: {tickets.filter(ticket => ticket.status === 'emitido').length}</li>
              <li>• Tickets anulados: {tickets.filter(ticket => ticket.status === 'anulado').length}</li>
              <li>• Productos vendidos: {metrics.totalItems}</li>
            </ul>
          </div>
        )}

        {tab === 'historial' && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-foreground">Historial de tickets</h3>
            <div className="space-y-2">
              {tickets.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay actividad.</p>}
              {tickets.map(ticket => (
                <article key={ticket.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-foreground">Ticket #{ticket.number}</p>
                    <p className={`text-xs ${ticket.status === 'anulado' ? 'text-red-600' : 'text-emerald-700'}`}>{ticket.status}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(ticket.createdAtISO).toLocaleString('es-AR')} • {formatCurrency(ticket.total)}</p>
                </article>
              ))}
            </div>
          </div>
        )}

      </section>
    </div>
  );
}
