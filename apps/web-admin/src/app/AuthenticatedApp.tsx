import { useEffect } from 'react';
import { AppContext } from '@/app/providers/AppContext';
import { useAppState } from '@/app/providers/use-app-state';
import { LogoutContext, router, RouterProvider } from '@/app/router';
import type { CurrentUser } from '@/features/platform/types';

type AuthenticatedAppProps = {
  initialUser: CurrentUser;
  onLogout: () => void;
};

export default function AuthenticatedApp({ initialUser, onLogout }: AuthenticatedAppProps) {
  const appState = useAppState();
  const { setCurrentUser } = appState;

  useEffect(() => {
    setCurrentUser(initialUser);
  }, [initialUser, setCurrentUser]);

  return (
    <LogoutContext.Provider value={onLogout}>
      <AppContext.Provider value={appState}>
        <RouterProvider router={router} />
      </AppContext.Provider>
    </LogoutContext.Provider>
  );
}
