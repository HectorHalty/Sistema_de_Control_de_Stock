import { AlertTriangle, BarChart3, Construction, ShoppingBag, ShoppingCart, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import { useAppContext } from '@/app/providers/AppContext';
import { canAccessModule } from '@/features/platform/config/modules';

export function PlatformDashboardPage() {
  const { currentUser, products, orders, getTotalStock } = useAppContext();

  const canSeeStock = canAccessModule(currentUser.role, 'stock');
  const canSeeVentas = canAccessModule(currentUser.role, 'ventas');
  const canSeeOnline = canAccessModule(currentUser.role, 'online');
  const canSeeFutbol = canAccessModule(currentUser.role, 'futbol');

  const lowStockProducts = products.filter(product => getTotalStock(product) < 20).slice(0, 4);
  const pendingOrders = orders.filter(order => order.status === 'Pendiente').length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h1 className="text-foreground">Dashboard LCH</h1>
        <p className="mt-1 text-sm text-muted-foreground">Panel central unificado de modulos para la operacion diaria.</p>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canSeeStock && (
          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <header className="mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              <h3 className="text-foreground">Alertas de Stock Bajo</h3>
            </header>
            {lowStockProducts.length === 0 ? (
              <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">Sin alertas criticas. Inventario en rango saludable.</p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                    <span className="text-foreground">{product.name}</span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{getTotalStock(product)} uds</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}

        {canSeeVentas && (
          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <header className="mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-700" />
              <h3 className="text-foreground">Ventas Fisicas Recientes</h3>
            </header>
            <div className="flex h-36 items-end gap-2 rounded-xl bg-slate-50 p-3">
              {[38, 52, 43, 61, 58, 72, 64].map((value, index) => (
                <div key={value + index} className="flex-1 rounded-t-md bg-blue-500/80" style={{ height: `${value}%` }} />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Ultimos 7 dias - vista simulada para layout.</p>
          </article>
        )}

        {canSeeOnline && (
          <ComingSoonDashboardCard
            to="/online"
            title="Ventas Online"
            icon={ShoppingBag}
          />
        )}

        {canSeeFutbol && (
          <ComingSoonDashboardCard
            to="/futbol"
            title="Fútbol"
            icon={Trophy}
          />
        )}
      </section>

      {canSeeStock && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <header className="mb-3 flex items-center gap-2">
            <ShoppingCart size={18} className="text-[#3d7a3d]" />
            <h3 className="text-foreground">Stock y Compras</h3>
          </header>
          <p className="rounded-xl bg-[#3d7a3d]/10 px-4 py-3 text-sm text-[#2f5f2f]">
            {pendingOrders > 0
              ? `Hay ${pendingOrders} pedido(s) pendiente(s) en el modulo de stock.`
              : 'No hay pedidos pendientes en stock.'}
          </p>
        </section>
      )}

      {!canSeeStock && !canSeeVentas && !canSeeOnline && !canSeeFutbol && (
        <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          No hay modulos asignados para este perfil.
        </section>
      )}
    </div>
  );
}

function ComingSoonDashboardCard({
  to,
  title,
  icon: Icon,
}: {
  to: string;
  title: string;
  icon: typeof ShoppingBag;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <Icon size={18} className="text-[#3d7a3d]" />
        <h3 className="text-foreground">{title}</h3>
      </header>
      <div className="flex flex-col items-center rounded-xl bg-[#3d7a3d]/5 px-4 py-6 text-center">
        <Construction size={28} className="text-[#3d7a3d]" />
        <p className="mt-3 text-sm font-medium text-foreground">En desarrollo</p>
        <p className="mt-1 text-xs text-muted-foreground">Próximamente</p>
        <Link
          to={to}
          className="mt-4 text-sm font-medium text-[#3d7a3d] hover:text-[#2f5f2f]"
        >
          Ver detalle →
        </Link>
      </div>
    </article>
  );
}
