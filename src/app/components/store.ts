import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';

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
  status: 'Pendiente' | 'Confirmado';
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

/** Consumo manual (no venta): producto retirado del stock. */
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
export const initialCategories: Category[] = [
  { id: 'cat1', name: 'Bebidas', icon: 'Wine' },
  { id: 'cat2', name: 'Snacks', icon: 'Cookie' },
  { id: 'cat3', name: 'Panadería', icon: 'Croissant' },
  { id: 'cat4', name: 'Carnes', icon: 'Beef' },
  { id: 'cat5', name: 'Insumos', icon: 'Wrench' },
];

export const initialWarehouses: Warehouse[] = [
  { id: 'w1', name: 'Depósito Principal', location: 'Edificio Central' },
  { id: 'w2', name: 'Quincho Bar', location: 'Zona Quincho' },
  { id: 'w3', name: 'Kiosco Cancha', location: 'Cancha 1' },
  { id: 'w4', name: 'Heladera Vestuarios', location: 'Vestuarios' },
];

export const initialProducts: Product[] = [
  {
    id: 'p1', name: 'Coca-Cola 500ml', code: 'BEB-001', description: 'Gaseosa Coca-Cola 500ml',
    category: 'Bebidas', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 120 }, { warehouseId: 'w2', quantity: 48 }, { warehouseId: 'w3', quantity: 24 }],
  },
  {
    id: 'p2', name: 'Agua Mineral 500ml', code: 'BEB-002', description: 'Agua mineral sin gas',
    category: 'Bebidas', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 200 }, { warehouseId: 'w3', quantity: 36 }],
  },
  {
    id: 'p3', name: 'Cerveza Quilmes Lata', code: 'BEB-003', description: 'Cerveza Quilmes 473ml lata',
    category: 'Bebidas', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 96 }, { warehouseId: 'w2', quantity: 72 }, { warehouseId: 'w4', quantity: 24 }],
  },
  {
    id: 'p4', name: 'Papas Fritas Grandes', code: 'SNK-001', description: 'Papas fritas paquete grande 300g',
    category: 'Snacks', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 40 }, { warehouseId: 'w2', quantity: 12 }],
  },
  {
    id: 'p5', name: 'Pan de Pancho x12', code: 'PAN-001', description: 'Paquete de pan de pancho x12 unidades',
    category: 'Panadería', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 30 }, { warehouseId: 'w2', quantity: 8 }],
  },
  {
    id: 'p6', name: 'Salchichas x12', code: 'CAR-001', description: 'Salchichas tipo viena x12',
    category: 'Carnes', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 25 }, { warehouseId: 'w4', quantity: 10 }],
  },
  {
    id: 'p7', name: 'Carbón 5kg', code: 'INS-001', description: 'Bolsa de carbón para parrilla 5kg',
    category: 'Insumos', unit: 'kg', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 15 }],
  },
  {
    id: 'p8', name: 'Fernet Branca 750ml', code: 'BEB-004', description: 'Fernet Branca botella 750ml',
    category: 'Bebidas', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 18 }, { warehouseId: 'w2', quantity: 6 }],
  },
  {
    id: 'p9', name: 'Gatorade 500ml', code: 'BEB-005', description: 'Bebida isotónica Gatorade',
    category: 'Bebidas', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 60 }, { warehouseId: 'w3', quantity: 18 }],
  },
  {
    id: 'p10', name: 'Medialunas x6', code: 'PAN-002', description: 'Medialunas de manteca x6',
    category: 'Panadería', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w2', quantity: 10 }],
  },
  {
    id: 'p11', name: 'Pan de Hamburguesa', code: 'INS-002', description: 'Pan de hamburguesa individual',
    category: 'Insumos', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 60 }],
  },
  {
    id: 'p12', name: 'Medallón de Carne', code: 'CAR-002', description: 'Medallón para hamburguesa',
    category: 'Carnes', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 55 }],
  },
  {
    id: 'p13', name: 'Queso Cheddar Feta', code: 'INS-003', description: 'Fetas de queso cheddar',
    category: 'Insumos', unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 80 }],
  },
];

export const initialSuppliers: Supplier[] = [
  { id: 'sup1', name: 'Distribuidora Norte', productIds: ['p1', 'p2', 'p3', 'p8', 'p9'] },
  { id: 'sup2', name: 'Mayorista del Sur', productIds: ['p4', 'p5', 'p6', 'p10'] },
  { id: 'sup3', name: 'Insumos La Pampa', productIds: ['p7'] },
];

export const initialKitchens: Kitchen[] = [
  { id: 'k-parrilla', name: 'Parrilla', emoji: '🔥', active: true },
  { id: 'k-cocina', name: 'Cocina', emoji: '🍳', active: true },
  { id: 'k-cerveceria', name: 'Cervecería', emoji: '🍺', active: true },
  { id: 'k-barra', name: 'Barra', emoji: '🍹', active: true },
];

export const initialSalesProducts: SalesProduct[] = [
  {
    id: 'sp-hamburguesa-simple', name: 'Hamburguesa Simple', category: 'Comidas',
    kitchenId: 'k-parrilla', price: 5200, emoji: '🍔', active: true,
    recipe: [{ stockProductId: 'p11', quantity: 1 }, { stockProductId: 'p12', quantity: 1 }, { stockProductId: 'p13', quantity: 1 }],
  },
  {
    id: 'sp-hamburguesa-completa', name: 'Hamburguesa Completa', category: 'Comidas',
    kitchenId: 'k-parrilla', price: 6900, emoji: '🍔', active: true,
    recipe: [{ stockProductId: 'p11', quantity: 1 }, { stockProductId: 'p12', quantity: 1 }, { stockProductId: 'p13', quantity: 2 }],
  },
  {
    id: 'sp-pancho', name: 'Pancho', category: 'Comidas',
    kitchenId: 'k-cocina', price: 3500, emoji: '🌭', active: true,
    recipe: [{ stockProductId: 'p5', quantity: 1 }, { stockProductId: 'p6', quantity: 1 }],
  },
  {
    id: 'sp-coca', name: 'Coca-Cola 500ml', category: 'Bebidas',
    kitchenId: 'k-cerveceria', price: 2900, emoji: '🥤', active: true,
    recipe: [{ stockProductId: 'p1', quantity: 1 }],
  },
  {
    id: 'sp-agua', name: 'Agua Mineral 500ml', category: 'Bebidas',
    kitchenId: 'k-cerveceria', price: 2200, emoji: '💧', active: true,
    recipe: [{ stockProductId: 'p2', quantity: 1 }],
  },
  {
    id: 'sp-cerveza', name: 'Cerveza Quilmes Lata', category: 'Bebidas',
    kitchenId: 'k-cerveceria', price: 3700, emoji: '🍺', active: true,
    recipe: [{ stockProductId: 'p3', quantity: 1 }],
  },
  {
    id: 'sp-papas', name: 'Papas Fritas Grandes', category: 'Snacks',
    kitchenId: 'k-cocina', price: 4100, emoji: '🍟', active: true,
    recipe: [{ stockProductId: 'p4', quantity: 1 }],
  },
  {
    id: 'sp-combo-cantina', name: 'Combo Cantina', category: 'Promos',
    kitchenId: 'k-cocina', price: 9900, emoji: '🎯', active: true,
    recipe: [{ stockProductId: 'p5', quantity: 1 }, { stockProductId: 'p6', quantity: 1 }, { stockProductId: 'p1', quantity: 2 }],
  },
  {
    id: 'sp-fernet', name: 'Fernet Branca 750ml', category: 'Bebidas',
    kitchenId: 'k-barra', price: 8500, emoji: '🥃', active: true,
    recipe: [{ stockProductId: 'p8', quantity: 1 }],
  },
  {
    id: 'sp-gatorade', name: 'Gatorade 500ml', category: 'Bebidas',
    kitchenId: 'k-cerveceria', price: 2500, emoji: '⚡', active: true,
    recipe: [{ stockProductId: 'p9', quantity: 1 }],
  },
];

export const initialTables: SalesTable[] = [
  { id: 't1', name: 'Mesa 1', status: 'libre' },
  { id: 't2', name: 'Mesa 2', status: 'libre' },
  { id: 't3', name: 'Mesa 3', status: 'libre' },
  { id: 't4', name: 'Mesa 4', status: 'libre' },
  { id: 't5', name: 'Mesa 5', status: 'libre' },
  { id: 't6', name: 'Mesa 6', status: 'libre' },
];

export const initialOrders: Order[] = [
  {
    id: 'PED-001', date: '2026-03-10', provider: 'Distribuidora Norte', status: 'Confirmado',
    items: [
      { productId: 'p1', quantityOrdered: 120 },
      { productId: 'p2', quantityOrdered: 96 },
      { productId: 'p3', quantityOrdered: 144 },
    ],
  },
  {
    id: 'PED-002', date: '2026-03-13', provider: 'Mayorista del Sur', status: 'Pendiente',
    items: [
      { productId: 'p4', quantityOrdered: 48 },
      { productId: 'p5', quantityOrdered: 24 },
      { productId: 'p6', quantityOrdered: 24 },
    ],
  },
];

export const initialAuditLog: AuditEntry[] = [
  { id: 'a1', date: '2026-03-16 09:15', user: 'Admin', module: 'stock', action: 'Edición Stock Almacén Depósito Principal', element: 'Coca-Cola 500ml', previousValue: '100', newValue: '120' },
  { id: 'a2', date: '2026-03-15 18:30', user: 'Juan Pérez', module: 'stock', action: 'Confirmación Pedido PED-001', element: 'PED-001', previousValue: '-', newValue: 'Confirmado' },
  { id: 'a3', date: '2026-03-15 14:00', user: 'Admin', module: 'stock', action: 'Alta Producto', element: 'Medialunas x6', previousValue: '-', newValue: '-' },
  { id: 'a4', date: '2026-03-14 10:45', user: 'María García', module: 'stock', action: 'Edición Stock Almacén Quincho Bar', element: 'Cerveza Quilmes Lata', previousValue: '48', newValue: '72' },
  { id: 'a5', date: '2026-03-13 16:20', user: 'Admin', module: 'stock', action: 'Creación Pedido PED-002', element: 'PED-002', previousValue: '-', newValue: 'Enviado' },
  { id: 'a6', date: '2026-03-12 11:00', user: 'Juan Pérez', module: 'stock', action: 'Edición Stock Almacén Kiosco Cancha', element: 'Agua Mineral 500ml', previousValue: '24', newValue: '36' },
];

export const initialUsers: AppUser[] = [
  { id: 'u1', name: 'Admin', role: 'Admin' },
  { id: 'u2', name: 'Juan Pérez', role: 'Operador' },
  { id: 'u3', name: 'María García', role: 'Operador' },
  { id: 'u4', name: 'Carlos López', role: 'Viewer' },
];

export function useAppState() {
  const [products, setProducts] = useLocalStorage<Product[]>('stock-products', initialProducts);
  const [warehouses, setWarehouses] = useLocalStorage<Warehouse[]>('stock-warehouses', initialWarehouses);
  const [orders, setOrders] = useLocalStorage<Order[]>('stock-orders', initialOrders);
  const [auditLog, setAuditLog] = useLocalStorage<AuditEntry[]>('stock-auditlog', initialAuditLog);
  const [salesAuditLog, setSalesAuditLog] = useLocalStorage<AuditEntry[]>('sales-auditlog', []);
  const [categories, setCategories] = useLocalStorage<Category[]>('stock-categories', initialCategories);
  const [consumptionLogs, setConsumptionLogs] = useLocalStorage<ConsumptionLog[]>('stock-consumption', []);
  const [employeeConsumptionLogs, setEmployeeConsumptionLogs] = useLocalStorage<EmployeeConsumptionEntry[]>(
    'stock-employee-consumption',
    [],
  );
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

  const appendAudit = (
    setter: Dispatch<SetStateAction<AuditEntry[]>>,
    module: AuditModule,
    entry: Omit<AuditEntry, 'id' | 'date' | 'module'>,
  ) => {
    setter(prev => [{
      ...entry,
      module,
      id: `a${Date.now()}`,
      date: new Date().toLocaleString('es-AR'),
    }, ...prev]);
  };

  const addStockAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date' | 'module'>) => {
    appendAudit(setAuditLog, 'stock', entry);
  }, [setAuditLog]);

  const addSalesAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date' | 'module'>) => {
    appendAudit(setSalesAuditLog, 'ventas', entry);
  }, [setSalesAuditLog]);

  const addAudit = addStockAudit;

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
    salesAuditLog, setSalesAuditLog,
    addStockAudit,
    addSalesAudit,
    categories, setCategories,
    consumptionLogs, setConsumptionLogs,
    employeeConsumptionLogs, setEmployeeConsumptionLogs,
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
