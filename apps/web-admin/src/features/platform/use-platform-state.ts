import { useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { initialUsers } from './types';
import type { AppUser, CurrentUser } from './types';

export function usePlatformState() {
  const [darkMode, setDarkModeState] = useLocalStorage<boolean>(storageKeys.inventory.darkMode, false);
  const [stockAlertDay, setStockAlertDay] = useLocalStorage<string>(storageKeys.inventory.alertDay, 'Jueves');
  const [currentUser, setCurrentUser] = useLocalStorage<CurrentUser>(storageKeys.inventory.currentUser, {
    username: 'admin',
    role: 'Admin',
  });
  const [users, setUsers] = useLocalStorage<AppUser[]>(storageKeys.inventory.users, initialUsers);

  const setDarkMode = useCallback((value: boolean) => {
    setDarkModeState(value);
    document.documentElement.classList.toggle('dark', value);
  }, [setDarkModeState]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return {
    darkMode,
    setDarkMode,
    stockAlertDay,
    setStockAlertDay,
    currentUser,
    setCurrentUser,
    users,
    setUsers,
  };
}

export type PlatformState = ReturnType<typeof usePlatformState>;
