import { AlertTriangle, BarChart3, ShoppingBag, ShoppingCart, Trophy, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { useAppContext } from '@/app/providers/AppContext';
import { canAccessModule } from '@/features/platform/config/modules';

export function PlatformDashboardPage() {
  const { currentUser, products, orders, getTotalStock } = useAppContext();

  const canSeeStock = canAccessModule(currentUser.role, 'stock');
  const canSeeVentas = canAccessModule(currentUser.role, 'ventas');
  const canSeeOnline = canAccessModule(currentUser.role, 'online');
  const canSeeFutbol = canAccessModule(currentUser.role, 'futbol');

  const lowStockProducts = products.filter((product) => getTotalStock(product) < 20).slice(0, 4);
  const pendingOrders = orders.filter((order) => order.status === 'Pendiente').length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h1 className="text-foreground">Dashboard LCH</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Panel central unificado de módulos para la operación diaria.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canSeeStock && (
          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <header className="mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              <h3 className="text-foreground">Alertas de Stock Bajo</h3>
            </header>
            {lowStockProducts.length === 0 ? (
              <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
                Sin alertas críticas. Inventario en rango saludable.
              </p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/40"
                  >
                    <span className="text-foreground">{product.name}</span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      {getTotalStock(product)} uds
                    </span>
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
              <h3 className="text-foreground">Ventas Físicas Recientes</h3>
            </header>
            <div className="flex h-36 items-end gap-2 rounded-xl bg-slate-50 p-3 dark:bg-muted">
              {[38, 52, 43, 61, 58, 72, 64].map((value, index) => (
                <div
                  key={value + index}
                  className="flex-1 rounded-t-md bg-blue-500/80"
                  style={{ height: `${value}%` }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Últimos 7 días — vista simulada para layout.</p>
          </article>
        )}

        {canSeeOnline && (
          <ModuleDashboardCard
            to="/online"
            title="Ventas Online"
            description="Cocina, escáner QR, menú web, sponsors y métricas."
            icon={ShoppingBag}
          />
        )}

        {canSeeFutbol && (
          <ModuleDashboardCard
            to="/futbol"
            title="Fútbol"
            description="Torneos, fixture multi-categoría, resultados, planteles y media."
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
          <p className="rounded-xl bg-[#3d7a3d]/10 px-4 py-3 text-sm text-[#2f5f2f] dark:text-[#8bc48b]">
            {pendingOrders > 0
              ? `Hay ${pendingOrders} pedido(s) pendiente(s) en el módulo de stock.`
              : 'No hay pedidos pendientes en stock.'}
          </p>
        </section>
      )}

      {!canSeeStock && !canSeeVentas && !canSeeOnline && !canSeeFutbol && (
        <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          No hay módulos asignados para este perfil.
        </section>
      )}
    </div>
  );
}

function ModuleDashboardCard({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: typeof ShoppingBag;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <Icon size={18} className="text-[#3d7a3d]" />
        <h3 className="text-foreground">{title}</h3>
      </header>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link
        to={to}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#3d7a3d] hover:underline"
      >
        Abrir módulo
        <ArrowRight size={14} />
      </Link>
    </article>
  );
}
