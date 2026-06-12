export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  unit: 'unidades' | 'kg';
  orderUnit?: number;
  image: string;
  stockByWarehouse: { warehouseId: string; quantity: number }[];
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  icon?: string;
}

export interface Order {
  id: string;
  date: string;
  provider: string;
  status: 'Pendiente' | 'Recibido';
  receivedAtISO?: string;
  items: { productId: string; quantityOrdered: number; quantityReceived?: number }[];
}

/**
 * Tipo de movimiento de stock. La cantidad del movimiento es SIGNADA respecto al
 * efecto sobre el stock: las salidas son negativas y las entradas positivas.
 */
export type StockMovementType =
  | 'venta'
  | 'venta_anulada'
  | 'devolucion'
  | 'consumo'
  | 'entrada'
  | 'ajuste_manual';

/** Asiento del libro de movimientos de stock (fuente para la conciliación). */
export interface StockMovement {
  id: string;
  createdAtISO: string;
  type: StockMovementType;
  productId: string;
  warehouseId?: string;
  /** Cantidad signada: salida negativa, entrada positiva. */
  quantity: number;
  /** Referencia al documento de origen (ticket, pedido, consumo, etc.). */
  reference?: string;
  operatorId?: string;
  operatorName?: string;
}

/** Conteo físico de un producto dentro de una sesión de control de stock. */
export interface StockCountEntry {
  productId: string;
  productName: string;
  unit: 'unidades' | 'kg';
  /** Stock que el sistema esperaba (suma por almacenes) al momento del conteo. */
  expected: number;
  /** Stock contado físicamente (suma por almacenes). */
  counted: number;
}

/** Sesión de control de stock: foto completa de lo contado vs lo esperado. */
export interface StockCountSession {
  id: string;
  createdAtISO: string;
  date: string;
  dateType: 'regular' | 'after';
  operatorId?: string;
  operatorName?: string;
  entries: StockCountEntry[];
}

export interface Supplier {
  id: string;
  name: string;
  productIds: string[];
}

export interface ConsumptionLog {
  id: string;
  date: string;
  day?: string;
  createdAtISO?: string;
  dateType: 'regular' | 'after';
  entries: {
    productId: string;
    productName: string;
    warehouseId: string;
    warehouseName: string;
    previousStock: number;
    newStock: number;
    consumed: number;
    unit: 'unidades' | 'kg';
  }[];
}

export interface EmployeeConsumptionEntry {
  id: string;
  date: string;
  day: string;
  createdAtISO: string;
  productId: string;
  productName: string;
  productCode: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  unit: 'unidades' | 'kg';
  previousStock: number;
  newStock: number;
}

export type AuditModule = 'stock' | 'ventas';

export interface AuditEntry {
  id: string;
  date: string;
  user: string;
  action: string;
  element: string;
  previousValue?: string;
  newValue?: string;
  module?: AuditModule;
}

export function getUnitLabel(unit: Product['unit'], short = false): string {
  if (unit === 'kg') return 'kg';
  return short ? 'uds' : 'unidades';
}

export function roundUpToOrderUnit(quantity: number, orderUnit?: number): number {
  if (!orderUnit || orderUnit <= 1) return Math.max(0, quantity);
  if (quantity <= 0) return 0;
  return Math.ceil(quantity / orderUnit) * orderUnit;
}
