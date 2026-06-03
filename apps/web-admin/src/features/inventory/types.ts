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
  status: 'Pendiente' | 'Confirmado';
  items: { productId: string; quantityOrdered: number; quantityReceived?: number }[];
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
