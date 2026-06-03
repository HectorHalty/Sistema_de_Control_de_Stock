import { useCallback, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAppState } from '@/app/providers/use-app-state';
import { AppContext } from '@/app/providers/AppContext';
import { ErrorBoundary } from '@/app/layout/ErrorBoundary';
import { attachNumberInputScrollGuard } from '@/shared/utils/number-input-scroll';
import { LoginPage, LogoutContext, RouterProvider, router } from '@/app/router';

function openPublicSite() {
  if (Capacitor.isNativePlatform()) {
    window.open('https://lachacrafutbol.com', '_system');
  } else {
    window.open('http://localhost:5174', '_blank');
  }
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const appState = useAppState();

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
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

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <LoginPage
          onLogin={(user) => {
            appState.setCurrentUser(user);
            setIsLoggedIn(true);
          }}
          onPublicAccess={openPublicSite}
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
