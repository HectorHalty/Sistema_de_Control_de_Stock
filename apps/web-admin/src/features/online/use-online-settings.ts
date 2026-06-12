import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';

export function useOnlineSettings() {
  const [orderNotifications, setOrderNotifications] = useLocalStorage<boolean>(
    storageKeys.online.orderNotifications,
    true,
  );
  const [syncCatalogWithStock, setSyncCatalogWithStock] = useLocalStorage<boolean>(
    storageKeys.online.syncCatalogWithStock,
    true,
  );
  const [webChannelEnabled, setWebChannelEnabled] = useLocalStorage<boolean>(
    storageKeys.online.webChannelEnabled,
    true,
  );
  const [appChannelEnabled, setAppChannelEnabled] = useLocalStorage<boolean>(
    storageKeys.online.appChannelEnabled,
    true,
  );

  return {
    orderNotifications,
    setOrderNotifications,
    syncCatalogWithStock,
    setSyncCatalogWithStock,
    webChannelEnabled,
    setWebChannelEnabled,
    appChannelEnabled,
    setAppChannelEnabled,
  };
}

export type OnlineSettingsState = ReturnType<typeof useOnlineSettings>;
