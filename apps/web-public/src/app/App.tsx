import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { PublicSite } from './components/public/PublicSite';

export default function App() {
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

  return <PublicSite />;
}
