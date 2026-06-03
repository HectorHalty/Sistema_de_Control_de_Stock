import { createContext, useContext, type ReactNode } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { AppLayout } from '@/app/layout/AppLayout';
import { AppContext } from '@/app/providers/AppContext';
import { canAccessModule } from '@/features/platform/config/modules';
import { ConsumptionPage } from '@/features/inventory/pages/ConsumptionPage';
import { DashboardPage } from '@/features/inventory/pages/DashboardPage';
import { OrdersPage } from '@/features/inventory/pages/OrdersPage';
import { ProductsPage } from '@/features/inventory/pages/ProductsPage';
import { RegisterConsumptionPage } from '@/features/inventory/pages/RegisterConsumptionPage';
import { ReportsPage } from '@/features/inventory/pages/ReportsPage';
import { SuppliersPage } from '@/features/inventory/pages/SuppliersPage';
import { WarehousesPage } from '@/features/inventory/pages/WarehousesPage';
import { FutbolModule } from '@/features/futbol/FutbolModule';
import { OnlineModule } from '@/features/online/OnlineModule';
import { LoginPage } from '@/features/platform/pages/LoginPage';
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

function StockGuard({ children }: { children: ReactNode }) {
  const { currentUser } = useAppStateFromContext();
  if (!canAccessModule(currentUser.role, 'stock')) {
    return (
      <ModulePlaceholderPage
        title="Inventario"
        description="Tu perfil no tiene acceso al módulo de inventario."
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

function OnlineGuard() {
  const { currentUser } = useAppStateFromContext();
  if (!canAccessModule(currentUser.role, 'online')) {
    return <ModulePlaceholderPage title="Ventas Online" description="Tu perfil no tiene acceso al módulo de Ventas Online." denied />;
  }
  return <OnlineModule />;
}

function FutbolGuard() {
  const { currentUser } = useAppStateFromContext();
  if (!canAccessModule(currentUser.role, 'futbol')) {
    return <ModulePlaceholderPage title="Fútbol" description="Tu perfil no tiene acceso al módulo de Fútbol." denied />;
  }
  return <FutbolModule />;
}

const router = createHashRouter([
  {
    path: '/',
    Component: LayoutWrapper,
    children: [
      { index: true, Component: PlatformDashboardPage },
      { path: 'stock', Component: () => <StockGuard><DashboardPage /></StockGuard> },
      { path: 'ventas', Component: VentasGuard },
      { path: 'online', Component: OnlineGuard },
      { path: 'futbol', Component: FutbolGuard },
      { path: 'productos', Component: () => <StockGuard><ProductsPage /></StockGuard> },
      { path: 'almacenes', Component: () => <StockGuard><WarehousesPage /></StockGuard> },
      { path: 'pedidos', Component: () => <StockGuard><OrdersPage /></StockGuard> },
      { path: 'proveedores', Component: () => <StockGuard><SuppliersPage /></StockGuard> },
      { path: 'consumo', Component: () => <StockGuard><ConsumptionPage /></StockGuard> },
      { path: 'registrar-consumo', Component: () => <StockGuard><RegisterConsumptionPage /></StockGuard> },
      { path: 'reportes', Component: () => <StockGuard><ReportsPage /></StockGuard> },
      { path: 'configuracion', Component: SettingsPage },
    ],
  },
]);

export { LoginPage, LogoutContext, router, RouterProvider };
