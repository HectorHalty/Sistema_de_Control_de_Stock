import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { settingsApi } from '@/app/api/client';
import { persistRemoteConfig } from '@/shared/utils/remote-config';
import { rememberConfigRows } from '@/shared/utils/config-versions';
import type { AppUser, CurrentUser } from './types';

export function usePlatformState() {
  const [darkMode, setDarkModeState] = useLocalStorage<boolean>(storageKeys.inventory.darkMode, false);
  const [stockAlertDay, setStockAlertDayState] = useLocalStorage<string>(storageKeys.inventory.alertDay, 'Jueves');
  const [stockLowNotifications, setStockLowNotificationsState] = useLocalStorage<boolean>(
    storageKeys.inventory.lowStockNotifications,
    true,
  );
  const [stockAutoAlerts, setStockAutoAlertsState] = useLocalStorage<boolean>(storageKeys.inventory.autoAlerts, true);
  const [stockPackRounding, setStockPackRoundingState] = useLocalStorage<boolean>(storageKeys.inventory.packRounding, true);
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage<boolean>(
    storageKeys.platform.notificationsEnabled,
    true,
  );
  const [notificationSound, setNotificationSound] = useLocalStorage<boolean>(storageKeys.platform.notificationSound, true);
  const [currentUser, setCurrentUser] = useLocalStorage<CurrentUser>(storageKeys.inventory.currentUser, {
    username: '',
    role: 'Vendedor',
  });
  const [users, setUsers] = useLocalStorage<AppUser[]>(storageKeys.inventory.users, []);

  const applyTheme = (value: boolean) => {
    const root = document.documentElement;
    root.classList.toggle('dark', value);
    root.style.colorScheme = value ? 'dark' : 'light';
  };

  const setDarkMode = useCallback((value: boolean) => {
    setDarkModeState(value);
    applyTheme(value);
  }, [setDarkModeState]);

  const setStockAlertDay = useCallback((value: string) => {
    setStockAlertDayState(value);
    persistRemoteConfig('stock.alertDay', 'stock', value);
  }, [setStockAlertDayState]);
  const setStockLowNotifications = useCallback((value: boolean) => {
    setStockLowNotificationsState(value);
    persistRemoteConfig('stock.lowStockNotifications', 'stock', value);
  }, [setStockLowNotificationsState]);
  const setStockAutoAlerts = useCallback((value: boolean) => {
    setStockAutoAlertsState(value);
    persistRemoteConfig('stock.autoAlerts', 'stock', value);
  }, [setStockAutoAlertsState]);
  const setStockPackRounding = useCallback((value: boolean) => {
    setStockPackRoundingState(value);
    persistRemoteConfig('stock.packRounding', 'stock', value);
  }, [setStockPackRoundingState]);

  useEffect(() => {
    applyTheme(darkMode);
  }, [darkMode]);

  const stockConfigQuery = useQuery({
    queryKey: ['settings', 'config', 'stock'],
    queryFn: async () => {
      const rows = await settingsApi.config.list('stock');
      rememberConfigRows(rows);
      return rows;
    },
  });

  useEffect(() => {
    if (!stockConfigQuery.data) return;
    for (const row of stockConfigQuery.data) {
      if (row.key === 'stock.alertDay' && typeof row.value === 'string') setStockAlertDayState(row.value);
      if (row.key === 'stock.lowStockNotifications' && typeof row.value === 'boolean') {
        setStockLowNotificationsState(row.value);
      }
      if (row.key === 'stock.autoAlerts' && typeof row.value === 'boolean') setStockAutoAlertsState(row.value);
      if (row.key === 'stock.packRounding' && typeof row.value === 'boolean') setStockPackRoundingState(row.value);
    }
  }, [
    stockConfigQuery.data,
    setStockAlertDayState,
    setStockLowNotificationsState,
    setStockAutoAlertsState,
    setStockPackRoundingState,
  ]);

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
