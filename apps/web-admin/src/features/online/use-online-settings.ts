import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { settingsApi } from '@/app/api/client';
import { persistRemoteConfig } from '@/shared/utils/remote-config';
import { rememberConfigRows } from '@/shared/utils/config-versions';

export function useOnlineSettings() {
  const [orderNotifications, setOrderNotificationsState] = useLocalStorage<boolean>(
    storageKeys.online.orderNotifications,
    true,
  );
  const [syncCatalogWithStock, setSyncCatalogWithStockState] = useLocalStorage<boolean>(
    storageKeys.online.syncCatalogWithStock,
    true,
  );
  const [webChannelEnabled, setWebChannelEnabledState] = useLocalStorage<boolean>(
    storageKeys.online.webChannelEnabled,
    true,
  );
  const [appChannelEnabled, setAppChannelEnabledState] = useLocalStorage<boolean>(
    storageKeys.online.appChannelEnabled,
    true,
  );

  const configQuery = useQuery({
    queryKey: ['settings', 'config', 'online'],
    queryFn: async () => {
      const rows = await settingsApi.config.list('online');
      rememberConfigRows(rows);
      return rows;
    },
  });

  useEffect(() => {
    if (!configQuery.data) return;
    for (const row of configQuery.data) {
      if (row.key === 'online.orderNotifications' && typeof row.value === 'boolean') {
        setOrderNotificationsState(row.value);
      }
      if (row.key === 'online.syncCatalogWithStock' && typeof row.value === 'boolean') {
        setSyncCatalogWithStockState(row.value);
      }
      if (row.key === 'online.webChannelEnabled' && typeof row.value === 'boolean') {
        setWebChannelEnabledState(row.value);
      }
      if (row.key === 'online.appChannelEnabled' && typeof row.value === 'boolean') {
        setAppChannelEnabledState(row.value);
      }
    }
  }, [
    configQuery.data,
    setOrderNotificationsState,
    setSyncCatalogWithStockState,
    setWebChannelEnabledState,
    setAppChannelEnabledState,
  ]);

  return {
    orderNotifications,
    setOrderNotifications: (value: boolean) => {
      setOrderNotificationsState(value);
      persistRemoteConfig('online.orderNotifications', 'online', value);
    },
    syncCatalogWithStock,
    setSyncCatalogWithStock: (value: boolean) => {
      setSyncCatalogWithStockState(value);
      persistRemoteConfig('online.syncCatalogWithStock', 'online', value);
    },
    webChannelEnabled,
    setWebChannelEnabled: (value: boolean) => {
      setWebChannelEnabledState(value);
      persistRemoteConfig('online.webChannelEnabled', 'online', value);
    },
    appChannelEnabled,
    setAppChannelEnabled: (value: boolean) => {
      setAppChannelEnabledState(value);
      persistRemoteConfig('online.appChannelEnabled', 'online', value);
    },
  };
}

export type OnlineSettingsState = ReturnType<typeof useOnlineSettings>;
