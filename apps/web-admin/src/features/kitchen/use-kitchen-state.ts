import { useQuery } from '@tanstack/react-query';
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
  const query = useQuery({
    queryKey: ['kitchen', 'orders'],
    queryFn: () => kitchenApi.orders.list().then(rows => rows.map(mapApiKitchenOrder)),
  });

  return {
    kitchenOrders: query.data ?? [],
    setKitchenOrders: (
      _next: KitchenOrder[] | ((prev: KitchenOrder[]) => KitchenOrder[]),
    ) => {
      // El KDS muta por kitchenApi.orders.transition, no por este setter.
      // Se deja la firma para no romper useAppState / notificaciones.
    },
  };
}

export type KitchenState = ReturnType<typeof useKitchenState>;
