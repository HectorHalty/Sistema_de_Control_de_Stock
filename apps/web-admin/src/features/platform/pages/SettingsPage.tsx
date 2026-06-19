import { useMemo, useState } from 'react';
import { Settings, Warehouse, CircleDollarSign, Trophy, Globe } from 'lucide-react';
import { useAppContext } from '@/app/providers/AppContext';
import {
  canAccessModule,
  canManageUsers,
  getRoleLabel,
  getSettingsTabs,
  ventasSettingsPrintersOnly,
  type SettingsTab,
} from '@/features/platform/config/modules';
import { GeneralSettingsTab } from '@/features/platform/settings/GeneralSettingsTab';
import { StockSettingsPanel } from '@/features/inventory/components/StockSettingsPanel';
import { SalesSettingsPanel } from '@/features/sales/components/SalesSettingsPanel';
import { FutbolSettingsPanel } from '@/features/futbol/components/FutbolSettingsPanel';
import { OnlineSettingsPanel } from '@/features/online/components/OnlineSettingsPanel';

const TAB_META: Record<SettingsTab, { label: string; icon: typeof Settings }> = {
  general: { label: 'General', icon: Settings },
  stock: { label: 'Stock', icon: Warehouse },
  ventas: { label: 'Ventas', icon: CircleDollarSign },
  futbol: { label: 'Futbol', icon: Trophy },
  online: { label: 'Online', icon: Globe },
};

export function SettingsPage() {
  const { currentUser } = useAppContext();
  const availableTabs = useMemo(() => getSettingsTabs(currentUser.role), [currentUser.role]);
  const [tab, setTab] = useState<SettingsTab>(() => availableTabs[0] ?? 'general');

  const tabs = useMemo(
    () => availableTabs.map(key => ({ key, ...TAB_META[key] })),
    [availableTabs],
  );

  const canSeeStock = canAccessModule(currentUser.role, 'stock');
  const canSeeVentas = canAccessModule(currentUser.role, 'ventas');
  const canSeeFutbol = canAccessModule(currentUser.role, 'futbol');
  const canSeeOnline = canAccessModule(currentUser.role, 'online');
  const printersOnly = ventasSettingsPrintersOnly(currentUser.role);

  if (tabs.length === 0) {
    return null;
  }

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
            {printersOnly && t.key === 'ventas' ? 'Impresoras' : t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralSettingsTab canManageUsers={canManageUsers(currentUser.role)} />}
      {tab === 'stock' && canSeeStock && <StockSettingsPanel />}
      {tab === 'ventas' && canSeeVentas && <SalesSettingsPanel printersOnly={printersOnly} />}
      {tab === 'futbol' && canSeeFutbol && <FutbolSettingsPanel />}
      {tab === 'online' && canSeeOnline && <OnlineSettingsPanel />}
    </div>
  );
}
