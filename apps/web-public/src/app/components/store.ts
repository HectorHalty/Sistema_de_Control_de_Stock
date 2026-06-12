import { useState, useCallback, useEffect } from 'react';

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("Error reading localStorage", error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn("Error setting localStorage", error);
    }
  };

  return [storedValue, setValue] as const;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // lucide icon name
}

export interface Product {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  unit: 'unidades' | 'kg';
  orderUnit?: number; // pack size for ordering (e.g., 24 = order in packs of 24)
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
  items: { productId: string; quantityOrdered: number; quantityReceived?: number }[];
}

export type UserRole =
  | 'Admin'
  | 'Operador'
  | 'Viewer'
  | 'SuperAdmin'
  | 'Gerente_Operaciones'
  | 'Encargado_Stock'
  | 'Encargado_Futbol';

export interface CurrentUser {
  username: string;
  role: UserRole;
}

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuditEntry {
  id: string;
  date: string;
  user: string;
  action: string;
  element: string;
  previousValue?: string;
  newValue?: string;
}

export interface ConsumptionLog {
  id: string;
  date: string; // human-readable (legacy)
  day?: string; // YYYY-MM-DD (preferred for filtering)
  createdAtISO?: string; // ISO timestamp
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

export interface Supplier {
  id: string;
  name: string;
  productIds: string[]; // IDs de los productos que provee
}

// --- Sales module types ---

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

// --- Kitchen Display System types ---

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

// --- Online sales / CMS types ---

export interface OnlineProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  images: string[];
  category: string;
  attributes: Record<string, string>;
  active: boolean;
  stockProductId?: string; // linkage to stock product
}

export interface Sponsor {
  id: string;
  name: string;
  imageUrl: string;
  placement: 'banner' | 'fullscreen' | 'sidebar';
  active: boolean;
  linkUrl?: string;
}

export interface MediaItem {
  id: string;
  matchDate?: string; // YYYY-MM-DD
  type: 'image' | 'video';
  url: string;
  title: string;
  createdAtISO: string;
}
export const initialCategories: Category[] = [];

export const initialWarehouses: Warehouse[] = [];

export const initialProducts: Product[] = [];

export const initialSuppliers: Supplier[] = [];

export const initialKitchens: Kitchen[] = [
  { id: 'k-parrilla', name: 'Parrilla', emoji: '🔥', active: true },
  { id: 'k-cocina', name: 'Cocina', emoji: '🍳', active: true },
  { id: 'k-cerveceria', name: 'Cervecería', emoji: '🍺', active: true },
  { id: 'k-barra', name: 'Barra', emoji: '🍹', active: true },
];

export const initialSalesProducts: SalesProduct[] = [];

export const initialTables: SalesTable[] = [];

export const initialOrders: Order[] = [];

export const initialAuditLog: AuditEntry[] = [];

export const initialUsers: AppUser[] = [
  { id: 'u1', name: 'Admin', role: 'Admin' },
];

export function useAppState() {
  const [products, setProducts] = useLocalStorage<Product[]>('stock-products', initialProducts);
  const [warehouses, setWarehouses] = useLocalStorage<Warehouse[]>('stock-warehouses', initialWarehouses);
  const [orders, setOrders] = useLocalStorage<Order[]>('stock-orders', initialOrders);
  const [auditLog, setAuditLog] = useLocalStorage<AuditEntry[]>('stock-auditlog', initialAuditLog);
  const [categories, setCategories] = useLocalStorage<Category[]>('stock-categories', initialCategories);
  const [consumptionLogs, setConsumptionLogs] = useLocalStorage<ConsumptionLog[]>('stock-consumption', []);
  const [suppliers, setSuppliers] = useLocalStorage<Supplier[]>('stock-suppliers', initialSuppliers);
  const [darkMode, setDarkModeState] = useLocalStorage<boolean>('stock-darkmode', false);
  const [stockAlertDay, setStockAlertDay] = useLocalStorage<string>('stock-alert-day', 'Jueves');
  const [currentUser, setCurrentUser] = useLocalStorage<CurrentUser>('stock-current-user', { username: 'admin', role: 'Admin' });
  const [users, setUsers] = useLocalStorage<AppUser[]>('stock-users', initialUsers);
  // Sales module state
  const [kitchens, setKitchens] = useLocalStorage<Kitchen[]>('sales-kitchens', initialKitchens);
  const [salesProducts, setSalesProducts] = useLocalStorage<SalesProduct[]>('sales-products', initialSalesProducts);
  const [salesTickets, setSalesTickets] = useLocalStorage<SalesTicket[]>('sales-tickets', []);
  const [salesTicketCounter, setSalesTicketCounter] = useLocalStorage<number>('sales-ticket-counter', 1000);
  const [salesTables, setSalesTables] = useLocalStorage<SalesTable[]>('sales-tables', initialTables);
  const [salesHistory, setSalesHistory] = useLocalStorage<SalesHistoryEntry[]>('sales-history', []);
  // Kitchen Display System
  const [kitchenOrders, setKitchenOrders] = useLocalStorage<KitchenOrder[]>('kitchen-orders', []);
  // Online sales / CMS
  const [onlineProducts, setOnlineProducts] = useLocalStorage<OnlineProduct[]>('online-products', []);
  const [sponsors, setSponsors] = useLocalStorage<Sponsor[]>('sponsors', []);
  const [mediaItems, setMediaItems] = useLocalStorage<MediaItem[]>('media-items', []);

  const setDarkMode = useCallback((value: boolean) => {
    setDarkModeState(value);
    if (value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Apply dark mode on first load
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const addAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date'>) => {
    setAuditLog(prev => [{
      ...entry,
      id: `a${Date.now()}`,
      date: new Date().toLocaleString('es-AR'),
    }, ...prev]);
  }, []);

  const getTotalStock = useCallback((product: Product) => {
    return product.stockByWarehouse.reduce((sum, s) => sum + s.quantity, 0);
  }, []);

  const getWarehouseTotalProducts = useCallback((warehouseId: string) => {
    return products.reduce((sum, p) => {
      const stock = p.stockByWarehouse.find(s => s.warehouseId === warehouseId);
      return sum + (stock?.quantity || 0);
    }, 0);
  }, [products]);

  return {
    products, setProducts,
    warehouses, setWarehouses,
    orders, setOrders,
    auditLog, setAuditLog,
    categories, setCategories,
    consumptionLogs, setConsumptionLogs,
    suppliers, setSuppliers,
    darkMode, setDarkMode,
    stockAlertDay, setStockAlertDay,
    currentUser, setCurrentUser,
    users, setUsers,
    addAudit, getTotalStock, getWarehouseTotalProducts,
    // Sales module
    kitchens, setKitchens,
    salesProducts, setSalesProducts,
    salesTickets, setSalesTickets,
    salesTicketCounter, setSalesTicketCounter,
    salesTables, setSalesTables,
    salesHistory, setSalesHistory,
    // Kitchen Display System
    kitchenOrders, setKitchenOrders,
    // Online sales / CMS
    onlineProducts, setOnlineProducts,
    sponsors, setSponsors,
    mediaItems, setMediaItems,
  };
}

export type AppState = ReturnType<typeof useAppState>;

export function getUnitLabel(unit: Product['unit'], short = false): string {
  if (unit === 'kg') return 'kg';
  return short ? 'uds' : 'unidades';
}

/**
 * Round up a quantity to the nearest multiple of the order unit (pack size).
 * If no orderUnit is defined, returns the quantity as-is.
 * Example: avg=47, pack=24 => 48 (2 packs)
 */
export function roundUpToOrderUnit(quantity: number, orderUnit?: number): number {
  if (!orderUnit || orderUnit <= 1) return Math.max(0, quantity);
  if (quantity <= 0) return 0;
  return Math.ceil(quantity / orderUnit) * orderUnit;
}
