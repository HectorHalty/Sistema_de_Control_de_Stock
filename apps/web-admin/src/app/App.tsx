import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ErrorBoundary } from '@/app/layout/ErrorBoundary';
import { setAccessToken } from '@/app/api/client';
import { attachNumberInputScrollGuard } from '@/shared/utils/number-input-scroll';
import { storageKeys } from '@/shared/storage/keys';
import { LoginPage } from '@/features/platform/pages/LoginPage';
import type { CurrentUser } from '@/features/platform/types';

function readStoredSession(): CurrentUser | null {
  try {
    const token = localStorage.getItem(storageKeys.auth.accessToken);
    const rawUser = localStorage.getItem(storageKeys.auth.user);
    if (!token || !rawUser) return null;
    const user = JSON.parse(rawUser) as CurrentUser;
    setAccessToken(token);
    return user;
  } catch {
    return null;
  }
}

const AuthenticatedApp = lazy(() => import('@/app/AuthenticatedApp'));

function AppLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      Cargando…
    </div>
  );
}

function AppShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => readStoredSession());

  const handleLogin = useCallback((user: CurrentUser, token: string) => {
    setAccessToken(token);
    try {
      localStorage.setItem(storageKeys.auth.accessToken, token);
      localStorage.setItem(storageKeys.auth.user, JSON.stringify(user));
    } catch {
      // Si el almacenamiento falla, la sesión sigue activa en memoria.
    }
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    setAccessToken(null);
    try {
      localStorage.removeItem(storageKeys.auth.accessToken);
      localStorage.removeItem(storageKeys.auth.user);
    } catch {
      // ignorar errores de almacenamiento
    }
    setCurrentUser(null);
  }, []);

  useEffect(() => attachNumberInputScrollGuard(), []);

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

  if (!currentUser) {
    return (
      <LoginPage onLogin={handleLogin} />
    );
  }

  return (
    <Suspense fallback={<AppLoading />}>
      <AuthenticatedApp initialUser={currentUser} onLogout={handleLogout} />
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
