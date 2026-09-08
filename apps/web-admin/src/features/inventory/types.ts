export interface Category {
  id: string;
  name: string;
  icon: string;
}

/** Unidad de medida de un producto. Refleja el enum `UnidadMedida` de la API. */
export type UnidadMedida = 'unidades' | 'kg' | 'litros' | 'cajas';

export interface Product {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  unit: UnidadMedida;
  orderUnit?: number;
  image: string;
  stockByWarehouse: { warehouseId: string; quantity: number }[];
  /** Bloqueo optimista: versión leída del servidor (ausente en productos aún no sincronizados). */
  version?: number;
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
  /** Bloqueo optimista: versión leída del servidor. */
  version?: number;
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
  unit: UnidadMedida;
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
    unit: UnidadMedida;
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
  unit: UnidadMedida;
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

const UNIT_LABELS: Record<UnidadMedida, { long: string; short: string }> = {
  unidades: { long: 'unidades', short: 'uds' },
  kg: { long: 'kg', short: 'kg' },
  litros: { long: 'litros', short: 'L' },
  cajas: { long: 'cajas', short: 'cajas' },
};

export function getUnitLabel(unit: UnidadMedida, short = false): string {
  const label = UNIT_LABELS[unit] ?? UNIT_LABELS.unidades;
  return short ? label.short : label.long;
}

/** Peso y volumen admiten decimales; lo que se cuenta de a uno, no. */
export function isFractionalUnit(unit: UnidadMedida): boolean {
  return unit === 'kg' || unit === 'litros';
}

export function roundUpToOrderUnit(quantity: number, orderUnit?: number): number {
  if (!orderUnit || orderUnit <= 1) return Math.max(0, quantity);
  if (quantity <= 0) return 0;
  return Math.ceil(quantity / orderUnit) * orderUnit;
}
