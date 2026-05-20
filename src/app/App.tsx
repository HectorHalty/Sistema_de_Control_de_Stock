import { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LoginPage } from './components/LoginPage';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './components/DashboardPage';
import { ProductsPage } from './components/ProductsPage';
import { WarehousesPage } from './components/WarehousesPage';
import { OrdersPage } from './components/OrdersPage';
import { ReportsPage } from './components/ReportsPage';
import { SettingsPage } from './components/SettingsPage';
import { ConsumptionPage } from './components/ConsumptionPage';
import { SuppliersPage } from './components/SuppliersPage';
import { useAppState } from './components/store';
import { AppContext } from './components/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PlatformDashboardPage } from './components/PlatformDashboardPage';
import { ModulePlaceholderPage } from './components/ModulePlaceholderPage';
import { canAccessModule } from './components/platformAccess';
import { SalesModule } from './components/sales/SalesModule';
import { OnlineModule } from './components/online/OnlineModule';
import { FutbolModule } from './components/futbol/FutbolModule';
import { KitchenDisplayScreen } from './components/KitchenDisplayScreen';
import { PublicSite } from './components/public/PublicSite';

// Logout context to avoid module-level mutable variables
const LogoutContext = createContext<(() => void) | null>(null);

export function useLogout() {
  const logout = useContext(LogoutContext);
  return logout || (() => {});
}

function LayoutWrapper() {
  const logout = useLogout();
  return <AppLayout onLogout={logout} />;
}

function ModuleGuard({
  moduleId,
  title,
  description,
  ready,
}: {
  moduleId: 'stock' | 'ventas' | 'online' | 'futbol';
  title: string;
  description: string;
  ready: boolean;
}) {
  const { currentUser } = useAppStateFromContext();

  if (!canAccessModule(currentUser.role, moduleId)) {
    return <ModulePlaceholderPage title={title} description={description} denied />;
  }

  if (!ready) {
    return <ModulePlaceholderPage title={title} description={description} />;
  }

  return <DashboardPage />;
}

function StockGuard({ children }: { children: ReactNode }) {
  const { currentUser } = useAppStateFromContext();
  if (!canAccessModule(currentUser.role, 'stock')) {
    return <ModulePlaceholderPage title="Stock" description="Tu perfil no tiene acceso al modulo de stock." denied />;
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

function useAppStateFromContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppContext no disponible');
  return context;
}

const router = createHashRouter([
  {
    path: '/',
    Component: LayoutWrapper,
    children: [
      { index: true, Component: PlatformDashboardPage },
      {
        path: 'stock',
        Component: () => <StockGuard><DashboardPage /></StockGuard>,
      },
      {
        path: 'ventas',
        Component: VentasGuard,
      },
      {
        path: 'online',
        Component: OnlineGuard,
      },
      {
        path: 'futbol',
        Component: FutbolGuard,
      },
      { path: 'productos', Component: () => <StockGuard><ProductsPage /></StockGuard> },
      { path: 'almacenes', Component: () => <StockGuard><WarehousesPage /></StockGuard> },
      { path: 'pedidos', Component: () => <StockGuard><OrdersPage /></StockGuard> },
      { path: 'proveedores', Component: () => <StockGuard><SuppliersPage /></StockGuard> },
      { path: 'consumo', Component: () => <StockGuard><ConsumptionPage /></StockGuard> },
      { path: 'reportes', Component: () => <StockGuard><ReportsPage /></StockGuard> },
      { path: 'configuracion', Component: SettingsPage },
      { path: 'cocina', Component: () => <StockGuard><KitchenDisplayScreen /></StockGuard> },
    ],
  },
]);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPublic, setShowPublic] = useState(false);
  const appState = useAppState();

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
    setShowPublic(false);
  }, []);

  const handleLoginFromPublic = useCallback((user: { username: string; role: string }) => {
    setShowPublic(false);
    appState.setCurrentUser(user as any);
    setIsLoggedIn(true);
  }, [appState]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void CapApp.exitApp();
      }
    });
    return () => { void listener.then(l => l.remove()); };
  }, []);

  // Public site (no login required)
  if (showPublic) {
    return (
      <ErrorBoundary>
        <AppContext.Provider value={appState}>
          <PublicSite onLoginClick={() => setShowPublic(false)} />
        </AppContext.Provider>
      </ErrorBoundary>
    );
  }

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <LoginPage
          onLogin={(user) => {
            appState.setCurrentUser(user);
            setIsLoggedIn(true);
          }}
          onPublicAccess={() => setShowPublic(true)}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <LogoutContext.Provider value={handleLogout}>
        <AppContext.Provider value={appState}>
          <RouterProvider router={router} />
        </AppContext.Provider>
      </LogoutContext.Provider>
    </ErrorBoundary>
  );
}
