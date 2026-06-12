import { useEffect, useRef } from 'react';
import { AppContext } from '@/app/providers/AppContext';
import { useAppState } from '@/app/providers/use-app-state';
import { LogoutContext, router, RouterProvider } from '@/app/router';
import type { CurrentUser } from '@/features/platform/types';
import { buildBackfillMovements } from '@/features/inventory/backfill-movements';

type AuthenticatedAppProps = {
  initialUser: CurrentUser;
  onLogout: () => void;
};

export default function AuthenticatedApp({ initialUser, onLogout }: AuthenticatedAppProps) {
  const appState = useAppState();
  const { setCurrentUser } = appState;
  const backfilledRef = useRef(false);

  useEffect(() => {
    setCurrentUser(initialUser);
  }, [initialUser, setCurrentUser]);

  // Reconstruye el libro de movimientos desde el historial existente (una sola vez).
  useEffect(() => {
    if (backfilledRef.current) return;
    backfilledRef.current = true;
    const backfilled = buildBackfillMovements({
      existingMovements: appState.stockMovements,
      employeeConsumptionLogs: appState.employeeConsumptionLogs,
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
      <AppContext.Provider value={appState}>
        <RouterProvider router={router} />
      </AppContext.Provider>
    </LogoutContext.Provider>
  );
}
