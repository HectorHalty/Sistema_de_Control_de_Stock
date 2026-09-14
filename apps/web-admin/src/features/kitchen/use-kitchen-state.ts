import { useEffect } from 'react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { kitchenApi } from '@/app/api/client';
import type { KitchenOrder } from './types';

function mapApiKitchenOrder(row: {
  id: string;
  ticketId: string;
  ticketNumber: number;
  kitchenId: string;
  status: KitchenOrder['status'];
  operatorName: string;
  tableId?: string | null;
  tableName?: string | null;
  createdAt: string;
  updatedAt: string;
  kitchen?: { name?: string } | null;
  items: { salesProductId: string; name: string; quantity: number; emoji?: string | null }[];
}): KitchenOrder {
  return {
    id: row.id,
    ticketId: row.ticketId,
    ticketNumber: row.ticketNumber,
    kitchenId: row.kitchenId,
    kitchenName: row.kitchen?.name ?? '',
    items: row.items.map(i => ({
      salesProductId: i.salesProductId,
      name: i.name,
      quantity: i.quantity,
      emoji: i.emoji ?? '',
    })),
    status: row.status,
    createdAtISO: row.createdAt,
    updatedAtISO: row.updatedAt,
    operatorName: row.operatorName,
    tableId: row.tableId ?? undefined,
    tableName: row.tableName ?? undefined,
  };
}

export function useKitchenState() {
  const [kitchenOrders, setKitchenOrders] = useLocalStorage<KitchenOrder[]>(storageKeys.kitchen.orders, []);

  useEffect(() => {
    void kitchenApi.orders.list().then(rows => {
      setKitchenOrders(rows.map(mapApiKitchenOrder));
    }).catch(() => undefined);
  }, [setKitchenOrders]);

  return { kitchenOrders, setKitchenOrders };
}

export type KitchenState = ReturnType<typeof useKitchenState>;
