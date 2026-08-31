import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useAppContext } from '@/app/providers/AppContext';
import {
  canAccessFutbolTab,
  getDefaultFutbolTab,
  type FutbolTab,
} from '@/features/platform/config/modules';
import { ModulePlaceholderPage } from '@/features/platform/pages/ModulePlaceholderPage';
import { FutbolInicioPanel } from './panels/FutbolInicioPanel';
import { EquiposPanel } from './panels/EquiposPanel';
import { CapitanesPanel } from './panels/CapitanesPanel';
import { PlantelPanel } from './panels/PlantelPanel';
import { FixturePanel } from './panels/FixturePanel';
import { ResultadosPanel } from './panels/ResultadosPanel';
import { ReglamentoPanel } from './panels/ReglamentoPanel';
import { SuspendidosPanel } from './panels/SuspendidosPanel';
import { MediaPanel } from './panels/MediaPanel';

const VALID_TABS: FutbolTab[] = [
  'inicio',
  'equipos',
  'capitanes',
  'plantel',
  'fixture',
  'resultados',
  'reglamento',
  'suspendidos',
  'media',
];

function resolveTab(tabParam: string | null): FutbolTab {
  if (tabParam && VALID_TABS.includes(tabParam as FutbolTab)) {
    return tabParam as FutbolTab;
  }
  return 'inicio';
}

export function FutbolModule() {
  const { currentUser } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = resolveTab(searchParams.get('tab'));
  const tab = canAccessFutbolTab(currentUser.role, requestedTab)
    ? requestedTab
    : getDefaultFutbolTab(currentUser.role);

  useEffect(() => {
    if (searchParams.get('tab') !== tab) {
      const sp = new URLSearchParams(searchParams);
      sp.set('tab', tab);
      setSearchParams(sp, { replace: true });
    }
  }, [searchParams, setSearchParams, tab]);

  if (!canAccessFutbolTab(currentUser.role, tab)) {
    return (
      <ModulePlaceholderPage
        title="Fútbol"
        description="Tu perfil no tiene acceso a esta sección."
        denied
      />
    );
  }

  return (
    <div className="h-full min-h-[calc(100vh-12rem)]">
      {tab === 'inicio' && <FutbolInicioPanel />}
      {tab === 'equipos' && <EquiposPanel />}
      {tab === 'capitanes' && <CapitanesPanel />}
      {tab === 'plantel' && <PlantelPanel />}
      {tab === 'fixture' && <FixturePanel />}
      {tab === 'resultados' && <ResultadosPanel />}
      {tab === 'reglamento' && <ReglamentoPanel />}
      {tab === 'suspendidos' && <SuspendidosPanel />}
      {tab === 'media' && <MediaPanel />}
    </div>
  );
}
