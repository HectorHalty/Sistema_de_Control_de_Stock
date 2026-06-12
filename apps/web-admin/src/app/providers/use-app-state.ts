import { useInventoryState } from '@/features/inventory/use-inventory-state';
import { useKitchenState } from '@/features/kitchen/use-kitchen-state';
import { useFutbolSettings } from '@/features/futbol/use-futbol-settings';
import { useOnlineSettings } from '@/features/online/use-online-settings';
import { usePlatformState } from '@/features/platform/use-platform-state';
import { useSalesState } from '@/features/sales/use-sales-state';

export function useAppState() {
  const inventory = useInventoryState();
  const sales = useSalesState();
  const kitchen = useKitchenState();
  const platform = usePlatformState();
  const futbolSettings = useFutbolSettings();
  const onlineSettings = useOnlineSettings();

  return {
    ...inventory,
    ...sales,
    ...kitchen,
    ...platform,
    ...futbolSettings,
    ...onlineSettings,
    /** @deprecated Usar addStockAudit o addSalesAudit según el módulo. */
    addAudit: inventory.addStockAudit,
  };
}

export type AppState = ReturnType<typeof useAppState>;
