export interface Kitchen {
  id: string;
  name: string;
  emoji: string;
  active: boolean;
}

export interface SalesProduct {
  id: string;
  name: string;
  category: string;
  kitchenId: string;
  price: number;
  emoji: string;
  recipe: { stockProductId: string; quantity: number }[];
  active: boolean;
}

export interface SalesTicket {
  id: string;
  number: number;
  createdAtISO: string;
  status: 'emitido' | 'anulado' | 'devuelto';
  items: { salesProductId: string; name: string; unitPrice: number; quantity: number; kitchenId: string }[];
  total: number;
  operatorId: string;
  operatorName: string;
  note?: string;
}

export interface SalesTable {
  id: string;
  name: string;
  status: 'libre' | 'ocupada';
  currentOrderId?: string;
}

export interface SalesHistoryEntry {
  id: string;
  timestampISO: string;
  operatorId: string;
  operatorName: string;
  type: 'venta' | 'anulacion' | 'devolucion' | 'producto_creado' | 'producto_editado' | 'receta_creada' | 'receta_editada' | 'mesa_creada' | 'mesa_editada';
  detail: string;
  ticketId?: string;
}
