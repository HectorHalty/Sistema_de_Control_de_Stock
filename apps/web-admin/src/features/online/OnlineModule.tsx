import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useAppContext } from '@/app/providers/AppContext';
import {
  canAccessOnlineTab,
  getDefaultOnlineTab,
  type OnlineTab,
} from '@/features/platform/config/modules';
import { ModulePlaceholderPage } from '@/features/platform/pages/ModulePlaceholderPage';
import { OnlineInicioPanel } from './panels/OnlineInicioPanel';
import { CocinaOnlinePanel } from './panels/CocinaOnlinePanel';
import { MenuWebPanel } from './panels/MenuWebPanel';
import { SponsorsPanel } from './panels/SponsorsPanel';
import { MetricasPanel } from './panels/MetricasPanel';

const VALID_TABS: OnlineTab[] = ['inicio', 'cocina', 'menu', 'sponsors', 'metricas'];

function resolveTab(tabParam: string | null): OnlineTab {
  if (tabParam === 'escaner-qr') return 'cocina';
  if (tabParam && VALID_TABS.includes(tabParam as OnlineTab)) {
    return tabParam as OnlineTab;
  }
  return 'inicio';
}

export function OnlineModule() {
  const { currentUser } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = resolveTab(searchParams.get('tab'));
  const tab = canAccessOnlineTab(currentUser.role, requestedTab)
    ? requestedTab
    : getDefaultOnlineTab(currentUser.role);

  useEffect(() => {
    if (searchParams.get('tab') !== tab) {
      const sp = new URLSearchParams(searchParams);
      sp.set('tab', tab);
      setSearchParams(sp, { replace: true });
    }
  }, [searchParams, setSearchParams, tab]);

  if (!canAccessOnlineTab(currentUser.role, tab)) {
    return (
      <ModulePlaceholderPage
        title="Ventas Online"
        description="Tu perfil no tiene acceso a esta sección."
        denied
      />
    );
  }

  return (
    <div className="theme-neon-public dark h-full min-h-[calc(100vh-12rem)] rounded-2xl border border-[#2a2a2a]">
      {tab === 'inicio' && <OnlineInicioPanel />}
      {tab === 'cocina' && <CocinaOnlinePanel />}
      {tab === 'menu' && <MenuWebPanel />}
      {tab === 'sponsors' && <SponsorsPanel />}
      {tab === 'metricas' && <MetricasPanel />}
    </div>
  );
}
