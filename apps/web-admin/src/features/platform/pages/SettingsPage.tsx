import { useMemo, useState } from 'react';
import { Settings, Warehouse, CircleDollarSign, Trophy, Globe } from 'lucide-react';
import { useAppContext } from '@/app/providers/AppContext';
import { canAccessModule, getRoleLabel } from '@/features/platform/config/modules';
import { GeneralSettingsTab } from '@/features/platform/settings/GeneralSettingsTab';
import { StockSettingsPanel } from '@/features/inventory/components/StockSettingsPanel';
import { SalesSettingsPanel } from '@/features/sales/components/SalesSettingsPanel';
import { FutbolSettingsPanel } from '@/features/futbol/components/FutbolSettingsPanel';
import { OnlineSettingsPanel } from '@/features/online/components/OnlineSettingsPanel';

type SettingsTab = 'general' | 'stock' | 'ventas' | 'futbol' | 'online';

export function SettingsPage() {
  const { currentUser } = useAppContext();
  const [tab, setTab] = useState<SettingsTab>('general');

  const canManageUsers = currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin';
  const canSeeStock = canAccessModule(currentUser.role, 'stock');
  const canSeeVentas = canAccessModule(currentUser.role, 'ventas');
  const canSeeFutbol = canAccessModule(currentUser.role, 'futbol');
  const canSeeOnline = canAccessModule(currentUser.role, 'online');

  const tabs = useMemo(() => [
    { key: 'general' as const, label: 'General', icon: Settings },
    ...(canSeeStock ? [{ key: 'stock' as const, label: 'Stock', icon: Warehouse }] : []),
    ...(canSeeVentas ? [{ key: 'ventas' as const, label: 'Ventas', icon: CircleDollarSign }] : []),
    ...(canSeeFutbol ? [{ key: 'futbol' as const, label: 'Futbol', icon: Trophy }] : []),
    ...(canSeeOnline ? [{ key: 'online' as const, label: 'Online', icon: Globe }] : []),
  ], [canSeeStock, canSeeVentas, canSeeFutbol, canSeeOnline]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Configuracion</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {getRoleLabel(currentUser.role)} — {currentUser.username}
        </p>
      </div>

      <div className="flex gap-1 bg-card rounded-xl border border-border p-1 shadow-sm flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors ${tab === t.key ? 'bg-[#3d7a3d] text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralSettingsTab canManageUsers={canManageUsers} />}
      {tab === 'stock' && canSeeStock && <StockSettingsPanel />}
      {tab === 'ventas' && canSeeVentas && <SalesSettingsPanel />}
      {tab === 'futbol' && canSeeFutbol && <FutbolSettingsPanel />}
      {tab === 'online' && canSeeOnline && <OnlineSettingsPanel />}
    </div>
  );
}
