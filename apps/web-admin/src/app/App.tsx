import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ErrorBoundary } from '@/app/layout/ErrorBoundary';
import { attachNumberInputScrollGuard } from '@/shared/utils/number-input-scroll';
import { LoginPage } from '@/features/platform/pages/LoginPage';
import type { CurrentUser } from '@/features/platform/types';

const AuthenticatedApp = lazy(() => import('@/app/AuthenticatedApp'));

function AppLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] text-[#3a3a3a]">
      Cargando…
    </div>
  );
}

function AppShell() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const handleLogout = useCallback(() => {
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
      <LoginPage onLogin={setCurrentUser} />
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
