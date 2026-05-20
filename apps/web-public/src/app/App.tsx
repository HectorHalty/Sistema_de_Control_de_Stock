import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { PublicSite } from './components/public/PublicSite';
import { PublicAppContext, usePublicAppState } from './components/PublicAppContext';

export default function App() {
  const appState = usePublicAppState();
  const [showAdmin, setShowAdmin] = useState(false);

  const handleLoginClick = useCallback(() => {
    // In a split architecture, this would navigate to the admin app.
    // For local dev, we show a placeholder message.
    setShowAdmin(true);
  }, []);

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

  if (showAdmin) {
    return (
      <div className="min-h-screen bg-[#131313] text-[#e5e2e1] flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-[#6bfb9a] mb-4">Administracion</h1>
          <p className="text-[#bccabb] mb-6">
            La aplicacion de administracion se ejecuta en un puerto separado.
          </p>
          <p className="text-sm text-[#bccabb]">
            Admin: <code className="bg-[#2a2a2a] px-2 py-1 rounded">http://localhost:5173</code>
          </p>
          <button
            onClick={() => setShowAdmin(false)}
            className="mt-4 px-4 py-2 rounded-lg bg-[#3d7a3d] text-white hover:bg-[#4ade80] transition-colors"
          >
            Volver al sitio publico
          </button>
        </div>
      </div>
    );
  }

  return (
    <PublicAppContext.Provider value={appState}>
      <PublicSite onLoginClick={handleLoginClick} />
    </PublicAppContext.Provider>
  );
}
