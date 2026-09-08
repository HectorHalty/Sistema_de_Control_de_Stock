export interface Kitchen {
  id: string;
  name: string;
  emoji: string;
  active: boolean;
}

export type SalesProductKind = 'simple' | 'promo';

export interface SalesProductBundleItem {
  salesProductId: string;
  quantity: number;
  name?: string;
  emoji?: string;
}

export interface SalesProduct {
  id: string;
  name: string;
  /** Nombre de la categoría de venta, para mostrar/agrupar en la UI. */
  category: string;
  /** FK real contra CategoriaVenta — lo que efectivamente viaja al backend. */
  categoriaVentaId: string;
  kitchenId: string;
  price: number;
  emoji: string;
  kind: SalesProductKind;
  recipe: { stockProductId: string; quantity: number }[];
  bundle: SalesProductBundleItem[];
  active: boolean;
  /** Bloqueo optimista: versión leída del servidor (ausente en productos aún no sincronizados). */
  version?: number;
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
  /** 'pos' | 'online' | 'consumo' — un ticket de consumo interno tiene total $0 y no se imprime. */
  origen?: string;
  /** Snapshot de descuento por almacén (checkout API o POS local). */
  stockAllocations?: { stockProductId: string; warehouseId: string; quantity: number }[];
}

export interface SalesTable {
  id: string;
  name: string;
  status: 'libre' | 'ocupada';
  currentOrderId?: string;
}

export type SalesPrinterType = 'Comandera Cocina' | 'Mostrador' | 'Barra';

export interface SalesPrinter {
  id: string;
  name: string;
  type: SalesPrinterType;
  ip: string;
  port: number;
  paperWidth: 58 | 80;
  connected: boolean;
  isDefault: boolean;
}

export interface TicketTemplate {
  header: string;
  subheader: string;
  footer: string;
  showLogo: boolean;
  showDate: boolean;
  showOperator: boolean;
  showItemDetails: boolean;
  fontSize: 'sm' | 'md' | 'lg';
}

export const DEFAULT_TICKET_TEMPLATE: TicketTemplate = {
  header: 'LA CHACRA FUTBOL — CANTINA',
  subheader: 'Sistema de Gestión LCH',
  footer: '¡Gracias por tu compra!',
  showLogo: true,
  showDate: true,
  showOperator: true,
  showItemDetails: true,
  fontSize: 'md',
};

export interface SalesHistoryEntry {
  id: string;
  timestampISO: string;
  operatorId: string;
  operatorName: string;
  type: 'venta' | 'anulacion' | 'devolucion' | 'producto_creado' | 'producto_editado' | 'receta_creada' | 'receta_editada' | 'mesa_creada' | 'mesa_editada';
  detail: string;
  ticketId?: string;
}

export interface TeamAccount {
  id: string;
  team: string;
  openedAt: string;
  status: 'abierta';
  items: { productId: string; name: string; price: number; qty: number }[];
}
