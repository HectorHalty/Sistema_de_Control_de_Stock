import { useInventoryState } from '@/features/inventory/use-inventory-state';
import { useKitchenState } from '@/features/kitchen/use-kitchen-state';
import { usePlatformState } from '@/features/platform/use-platform-state';
import { useSalesState } from '@/features/sales/use-sales-state';

export function useAppState() {
  const inventory = useInventoryState();
  const sales = useSalesState();
  const kitchen = useKitchenState();
  const platform = usePlatformState();

  return {
    ...inventory,
    ...sales,
    ...kitchen,
    ...platform,
    /** @deprecated Usar addStockAudit o addSalesAudit según el módulo. */
    addAudit: inventory.addStockAudit,
  };
}

export type AppState = ReturnType<typeof useAppState>;
