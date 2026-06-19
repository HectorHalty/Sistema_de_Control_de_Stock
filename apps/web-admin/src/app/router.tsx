import { createContext, useContext, type ReactNode } from 'react';
import { createHashRouter, Navigate, RouterProvider, useLocation } from 'react-router';
import { AppLayout } from '@/app/layout/AppLayout';
import { AppContext } from '@/app/providers/AppContext';
import {
  canAccessModule,
  canAccessSettings,
  canAccessStockRoute,
  getAllowedModules,
  stockRouteFromPath,
  type ModuleId,
} from '@/features/platform/config/modules';
import { ConsumptionPage } from '@/features/inventory/pages/ConsumptionPage';
import { DashboardPage } from '@/features/inventory/pages/DashboardPage';
import { OrdersPage } from '@/features/inventory/pages/OrdersPage';
import { ProductsPage } from '@/features/inventory/pages/ProductsPage';
import { RegisterConsumptionPage } from '@/features/inventory/pages/RegisterConsumptionPage';
import { ReportsPage } from '@/features/inventory/pages/ReportsPage';
import { SuppliersPage } from '@/features/inventory/pages/SuppliersPage';
import { WarehousesPage } from '@/features/inventory/pages/WarehousesPage';
import { ModulePlaceholderPage } from '@/features/platform/pages/ModulePlaceholderPage';
import { PlatformDashboardPage } from '@/features/platform/pages/PlatformDashboardPage';
import { SettingsPage } from '@/features/platform/pages/SettingsPage';
import { SalesModule } from '@/features/sales/SalesModule';

const LogoutContext = createContext<(() => void) | null>(null);

export function useLogout() {
  return useContext(LogoutContext) || (() => {});
}

function useAppStateFromContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppContext no disponible');
  return context;
}

function LayoutWrapper() {
  const logout = useLogout();
  return <AppLayout onLogout={logout} />;
}

function StockRouteGuard({ children }: { children: ReactNode }) {
  const { currentUser } = useAppStateFromContext();
  const { pathname } = useLocation();
  const route = stockRouteFromPath(pathname);

  if (!canAccessModule(currentUser.role, 'stock')) {
    return (
      <ModulePlaceholderPage
        title="Inventario"
        description="Tu perfil no tiene acceso al módulo de inventario."
        denied
      />
    );
  }

  if (route && !canAccessStockRoute(currentUser.role, route)) {
    return (
      <ModulePlaceholderPage
        title="Inventario"
        description="Tu perfil no tiene acceso a esta sección del inventario."
        denied
      />
    );
  }

  return <>{children}</>;
}

function VentasGuard() {
  const { currentUser } = useAppStateFromContext();
  if (!canAccessModule(currentUser.role, 'ventas')) {
    return <ModulePlaceholderPage title="Ventas" description="Tu perfil no tiene acceso al módulo de Ventas." denied />;
  }
  return <SalesModule />;
}

function SettingsGuard() {
  const { currentUser } = useAppStateFromContext();
  if (!canAccessSettings(currentUser.role)) {
    return (
      <ModulePlaceholderPage
        title="Configuración"
        description="Tu perfil no tiene acceso a la configuración del sistema."
        denied
      />
    );
  }
  return <SettingsPage />;
}

function ComingSoonModuleGuard({
  moduleId,
  title,
}: {
  moduleId: Exclude<ModuleId, 'dashboard'>;
  title: string;
}) {
  const { currentUser } = useAppStateFromContext();
  if (!canAccessModule(currentUser.role, moduleId)) {
    return <ModulePlaceholderPage title={title} denied />;
  }
  return <ModulePlaceholderPage title={title} comingSoon />;
}

function OnlineGuard() {
  return <ComingSoonModuleGuard moduleId="online" title="Ventas Online" />;
}

function FutbolGuard() {
  return <ComingSoonModuleGuard moduleId="futbol" title="Fútbol" />;
}

function DefaultLandingRedirect() {
  const { currentUser } = useAppStateFromContext();
  const allowed = getAllowedModules(currentUser.role);

  if (allowed.length >= 2) {
    return <PlatformDashboardPage />;
  }

  const first = allowed[0];
  if (first === 'stock') return <Navigate to="/stock" replace />;
  if (first === 'ventas') return <Navigate to="/ventas" replace />;
  if (first === 'online') return <Navigate to="/online" replace />;
  if (first === 'futbol') return <Navigate to="/futbol" replace />;
  return <PlatformDashboardPage />;
}

const router = createHashRouter([
  {
    path: '/',
    Component: LayoutWrapper,
    children: [
      { index: true, Component: DefaultLandingRedirect },
      { path: 'stock', Component: () => <StockRouteGuard><DashboardPage /></StockRouteGuard> },
      { path: 'ventas', Component: VentasGuard },
      { path: 'online', Component: OnlineGuard },
      { path: 'futbol', Component: FutbolGuard },
      { path: 'productos', Component: () => <StockRouteGuard><ProductsPage /></StockRouteGuard> },
      { path: 'almacenes', Component: () => <StockRouteGuard><WarehousesPage /></StockRouteGuard> },
      { path: 'pedidos', Component: () => <StockRouteGuard><OrdersPage /></StockRouteGuard> },
      { path: 'proveedores', Component: () => <StockRouteGuard><SuppliersPage /></StockRouteGuard> },
      { path: 'consumo', Component: () => <StockRouteGuard><ConsumptionPage /></StockRouteGuard> },
      { path: 'registrar-consumo', Component: () => <StockRouteGuard><RegisterConsumptionPage /></StockRouteGuard> },
      { path: 'reportes', Component: () => <StockRouteGuard><ReportsPage /></StockRouteGuard> },
      { path: 'configuracion', Component: SettingsGuard },
    ],
  },
]);

export { LogoutContext, router, RouterProvider };
