import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { WifiOff, X } from 'lucide-react';
import { VentasPosProvider, useVentasPos } from './pos/VentasPosContext';
import { POSModule } from './pos/POSModule';
import { ProductsModule } from './pos/ProductsModule';
import { MyOrdersModule } from './pos/MyOrdersModule';
import { ReturnsModule } from './pos/ReturnsModule';
import { TablesModule } from './pos/TablesModule';
import { InicioModule } from './pos/InicioModule';
import { DashboardModule } from './pos/DashboardModule';
import { ReportesModule } from './pos/ReportesModule';
import { HistoryModule } from './pos/HistoryModule';

type VentasTab =
  | 'inicio'
  | 'mostrador'
  | 'pedidos'
  | 'devoluciones'
  | 'productos'
  | 'mesas'
  | 'metricas'
  | 'reportes'
  | 'historial';

const VALID_TABS: VentasTab[] = [
  'mostrador',
  'pedidos',
  'devoluciones',
  'productos',
  'mesas',
  'inicio',
  'metricas',
  'reportes',
  'historial',
];

function resolveTab(tabParam: string | null): VentasTab {
  const normalized = tabParam === 'caja' ? 'mostrador' : tabParam;
  if (normalized && VALID_TABS.includes(normalized as VentasTab)) {
    return normalized as VentasTab;
  }
  return 'mostrador';
}

function VentasPosShell() {
  const [searchParams] = useSearchParams();
  const tab = resolveTab(searchParams.get('tab'));
  const { apiOnline, toast, setToast } = useVentasPos();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  return (
    <div className="h-full min-h-[calc(100vh-12rem)]">
      {toast && (
        <div className="fixed top-20 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {apiOnline === false && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <WifiOff size={14} />
          Modo offline — los cambios se guardan localmente hasta que el servidor esté disponible.
        </div>
      )}

      <div className="h-full">
        {tab === 'inicio' && <InicioModule />}
        {tab === 'mostrador' && <POSModule />}
        {tab === 'pedidos' && <MyOrdersModule />}
        {tab === 'devoluciones' && <ReturnsModule />}
        {tab === 'productos' && <ProductsModule />}
        {tab === 'mesas' && <TablesModule />}
        {tab === 'metricas' && <DashboardModule />}
        {tab === 'reportes' && <ReportesModule />}
        {tab === 'historial' && <HistoryModule />}
      </div>
    </div>
  );
}

export function SalesModule() {
  return (
    <VentasPosProvider>
      <VentasPosShell />
    </VentasPosProvider>
  );
}
