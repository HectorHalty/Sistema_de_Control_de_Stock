import { useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { initialUsers } from './types';
import type { AppUser, CurrentUser } from './types';

export function usePlatformState() {
  const [darkMode, setDarkModeState] = useLocalStorage<boolean>(storageKeys.inventory.darkMode, false);
  const [stockAlertDay, setStockAlertDay] = useLocalStorage<string>(storageKeys.inventory.alertDay, 'Jueves');
  const [stockLowNotifications, setStockLowNotifications] = useLocalStorage<boolean>(
    storageKeys.inventory.lowStockNotifications,
    true,
  );
  const [stockAutoAlerts, setStockAutoAlerts] = useLocalStorage<boolean>(storageKeys.inventory.autoAlerts, true);
  const [stockPackRounding, setStockPackRounding] = useLocalStorage<boolean>(storageKeys.inventory.packRounding, true);
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage<boolean>(
    storageKeys.platform.notificationsEnabled,
    true,
  );
  const [notificationSound, setNotificationSound] = useLocalStorage<boolean>(storageKeys.platform.notificationSound, true);
  const [currentUser, setCurrentUser] = useLocalStorage<CurrentUser>(storageKeys.inventory.currentUser, {
    username: 'admin',
    role: 'Admin',
  });
  const [users, setUsers] = useLocalStorage<AppUser[]>(storageKeys.inventory.users, initialUsers);

  const applyTheme = (value: boolean) => {
    const root = document.documentElement;
    root.classList.toggle('dark', value);
    root.style.colorScheme = value ? 'dark' : 'light';
  };

  const setDarkMode = useCallback((value: boolean) => {
    setDarkModeState(value);
    applyTheme(value);
  }, [setDarkModeState]);

  useEffect(() => {
    applyTheme(darkMode);
  }, [darkMode]);

  return {
    darkMode,
    setDarkMode,
    stockAlertDay,
    setStockAlertDay,
    stockLowNotifications,
    setStockLowNotifications,
    stockAutoAlerts,
    setStockAutoAlerts,
    stockPackRounding,
    setStockPackRounding,
    notificationsEnabled,
    setNotificationsEnabled,
    notificationSound,
    setNotificationSound,
    currentUser,
    setCurrentUser,
    users,
    setUsers,
  };
}

export type PlatformState = ReturnType<typeof usePlatformState>;
