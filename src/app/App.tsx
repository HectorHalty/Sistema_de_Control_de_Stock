import { useState, useCallback, createContext, useContext, useEffect } from 'react';
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

const router = createHashRouter([
  {
    path: '/',
    Component: LayoutWrapper,
    children: [
      { index: true, Component: DashboardPage },
      { path: 'productos', Component: ProductsPage },
      { path: 'almacenes', Component: WarehousesPage },
      { path: 'pedidos', Component: OrdersPage },
      { path: 'proveedores', Component: SuppliersPage },
      { path: 'consumo', Component: ConsumptionPage },
      { path: 'reportes', Component: ReportsPage },
      { path: 'configuracion', Component: SettingsPage },
    ],
  },
]);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const appState = useAppState();

  const handleLogout = useCallback(() => setIsLoggedIn(false), []);

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

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <LoginPage
          onLogin={(user) => {
            appState.setCurrentUser(user);
            setIsLoggedIn(true);
          }}
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