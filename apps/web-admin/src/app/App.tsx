import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ErrorBoundary } from '@/app/layout/ErrorBoundary';
import { authApi, isApiError, setAccessToken } from '@/app/api/client';
import { attachNumberInputScrollGuard } from '@/shared/utils/number-input-scroll';
import { storageKeys } from '@/shared/storage/keys';
import { LoginPage } from '@/features/platform/pages/LoginPage';
import type { CurrentUser } from '@/features/platform/types';

function readStoredSession(): { user: CurrentUser; token: string } | null {
  try {
    const token = localStorage.getItem(storageKeys.auth.accessToken);
    const rawUser = localStorage.getItem(storageKeys.auth.user);
    if (!token || !rawUser) return null;
    const user = JSON.parse(rawUser) as CurrentUser;
    return { user, token };
  } catch {
    return null;
  }
}

function persistSession(user: CurrentUser, token: string) {
  setAccessToken(token);
  localStorage.setItem(storageKeys.auth.accessToken, token);
  localStorage.setItem(storageKeys.auth.user, JSON.stringify(user));
}

function clearSession() {
  setAccessToken(null);
  localStorage.removeItem(storageKeys.auth.accessToken);
  localStorage.removeItem(storageKeys.auth.user);
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [booting, setBooting] = useState(true);

  const handleLogout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
  }, []);

  const handleLogin = useCallback((user: CurrentUser, token: string) => {
    try {
      persistSession(user, token);
    } catch {
      setAccessToken(token);
    }
    setCurrentUser(user);
  }, []);

  useEffect(() => attachNumberInputScrollGuard(), []);

  useEffect(() => {
    const onInvalid = () => handleLogout();
    window.addEventListener('auth:session-invalid', onInvalid);
    return () => window.removeEventListener('auth:session-invalid', onInvalid);
  }, [handleLogout]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const stored = readStoredSession();
      if (!stored) {
        if (!cancelled) setBooting(false);
        return;
      }

      setAccessToken(stored.token);
      try {
        const res = await authApi.me();
        const user: CurrentUser = {
          id: res.user.id,
          username: res.user.username,
          role: res.user.role as CurrentUser['role'],
        };
        if (!cancelled) {
          persistSession(user, stored.token);
          setCurrentUser(user);
        }
      } catch (e) {
        if (!cancelled) {
          // 401 = token inválido. 429/red transitoria: mantener sesión local (no mandar al login).
          if (isApiError(e) && e.status === 401) {
            handleLogout();
          } else {
            setCurrentUser(stored.user);
          }
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    void boot();
    return () => { cancelled = true; };
  }, [handleLogout]);

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

  if (booting) {
    return <AppLoading />;
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
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
