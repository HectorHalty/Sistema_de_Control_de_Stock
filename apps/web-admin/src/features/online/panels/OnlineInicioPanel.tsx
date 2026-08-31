import { ChefHat, DollarSign, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { OnlineError, OnlinePanelShell, useOnlineOverview } from '../online-shared';

export function OnlineInicioPanel() {
  const { data, loading, error } = useOnlineOverview();

  if (loading) return <OnlinePanelShell title="Ventas online">Cargando...</OnlinePanelShell>;
  if (error) return <OnlinePanelShell title="Ventas online"><OnlineError message={error} /></OnlinePanelShell>;
  if (!data) return null;

  const cards = [
    { label: 'Pedidos hoy', value: data.pedidosHoy, icon: ShoppingBag },
    { label: 'Recaudación hoy', value: `$${data.recaudacionHoy.toLocaleString('es-AR')}`, icon: DollarSign },
    { label: 'En cocina', value: data.cocinaActivos, icon: ChefHat },
    { label: 'Ítems en menú web', value: data.menuVisible, icon: UtensilsCrossed },
  ];

  return (
    <OnlinePanelShell title="Ventas online">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <c.icon size={16} />
              <span className="text-xs uppercase tracking-wide">{c.label}</span>
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Totales históricos</p>
        <p className="text-sm text-muted-foreground">
          {data.pedidosTotal} pedidos · ${data.recaudacionTotal.toLocaleString('es-AR')} recaudados
        </p>
        {data.topItems.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {data.topItems.map((item) => (
              <li key={item.name}>
                {item.name} — {item.quantity} u.
              </li>
            ))}
          </ul>
        )}
      </div>
    </OnlinePanelShell>
  );
}
