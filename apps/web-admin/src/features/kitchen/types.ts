export type KitchenOrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered';

export interface KitchenOrder {
  id: string;
  ticketId: string;
  ticketNumber: number;
  kitchenId: string;
  kitchenName: string;
  items: { salesProductId: string; name: string; quantity: number; emoji: string }[];
  status: KitchenOrderStatus;
  createdAtISO: string;
  updatedAtISO: string;
  operatorName: string;
  tableId?: string;
  tableName?: string;
}
