import { useEffect, useRef } from 'react';
import { AppContext } from '@/app/providers/AppContext';
import { useAppState } from '@/app/providers/use-app-state';
import { LogoutContext, router, RouterProvider } from '@/app/router';
import type { CurrentUser } from '@/features/platform/types';
import { buildBackfillMovements } from '@/features/inventory/backfill-movements';
import { persistedUserIsStale } from '@/app/sync-session-user';

type AuthenticatedAppProps = {
  initialUser: CurrentUser;
  onLogout: () => void;
};

export default function AuthenticatedApp({ initialUser, onLogout }: AuthenticatedAppProps) {
  const appState = useAppState();
  const { currentUser, setCurrentUser } = appState;
  const backfilledRef = useRef(false);
  const isStale = persistedUserIsStale(currentUser, initialUser);

  // Patrón React: ajustar estado durante el render cuando la prop de sesión
  // no coincide con lo persistido. React descarta este JSX y vuelve a invocar
  // este componente antes de evaluar sus hijos; el override del context es
  // solamente defensivo.
  if (isStale) {
    setCurrentUser(initialUser);
  }

  const contextValue = isStale ? { ...appState, currentUser: initialUser } : appState;

  // Reconstruye el libro de movimientos desde el historial existente (una sola vez).
  useEffect(() => {
    if (backfilledRef.current) return;
    backfilledRef.current = true;
    const backfilled = buildBackfillMovements({
      existingMovements: appState.stockMovements,
      salesTickets: appState.salesTickets,
      salesProducts: appState.salesProducts,
      orders: appState.orders,
    });
    if (backfilled.length > 0) {
      appState.setStockMovements(prev => {
        const refs = new Set(prev.map(m => m.reference).filter(Boolean));
        const toAdd = backfilled.filter(m => !m.reference || !refs.has(m.reference));
        if (toAdd.length === 0) return prev;
        return [...toAdd, ...prev].sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LogoutContext.Provider value={onLogout}>
      <AppContext.Provider value={contextValue}>
        <RouterProvider router={router} />
      </AppContext.Provider>
    </LogoutContext.Provider>
  );
}
