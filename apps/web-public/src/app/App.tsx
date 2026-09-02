import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { PublicRouter } from './components/public/PublicRouter';
import { PublicAuthProvider } from './components/public/auth/PublicAuthContext';
import { CartProvider } from './components/public/cart/CartContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

function PublicAppShell() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void SplashScreen.hide();
    void StatusBar.setStyle({ style: Style.Dark });
    void StatusBar.setBackgroundColor({ color: '#111111' });

    const listener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void CapApp.exitApp();
      }
    });
    return () => {
      void listener.then((l) => l.remove());
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PublicAuthProvider>
        <CartProvider>
          <PublicRouter />
        </CartProvider>
      </PublicAuthProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return <PublicAppShell />;
}
