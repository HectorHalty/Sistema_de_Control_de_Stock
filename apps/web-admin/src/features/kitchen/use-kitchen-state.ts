import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import type { KitchenOrder } from './types';

export function useKitchenState() {
  const [kitchenOrders, setKitchenOrders] = useLocalStorage<KitchenOrder[]>(storageKeys.kitchen.orders, []);

  return { kitchenOrders, setKitchenOrders };
}

export type KitchenState = ReturnType<typeof useKitchenState>;
