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

export type UserRole = 'Admin' | 'Operador' | 'Viewer';

export interface CurrentUser {
  username: string;
  role: UserRole;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
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
  phone?: string;
  email?: string;
  productIds: string[]; // IDs de los productos que provee
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
];

export const initialSuppliers: Supplier[] = [
  { id: 'sup1', name: 'Distribuidora Norte', phone: '11-2345-6789', email: 'ventas@distnorte.com', productIds: ['p1', 'p2', 'p3', 'p8', 'p9'] },
  { id: 'sup2', name: 'Mayorista del Sur', phone: '11-9876-5432', email: 'pedidos@mayosur.com', productIds: ['p4', 'p5', 'p6', 'p10'] },
  { id: 'sup3', name: 'Insumos La Pampa', phone: '11-5555-1234', email: 'contacto@insumoslapampa.com', productIds: ['p7'] },
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
  { id: 'a1', date: '2026-03-16 09:15', user: 'Admin', action: 'Edición Stock Almacén Depósito Principal', element: 'Coca-Cola 500ml', previousValue: '100', newValue: '120' },
  { id: 'a2', date: '2026-03-15 18:30', user: 'Juan Pérez', action: 'Confirmación Pedido PED-001', element: 'PED-001', previousValue: '-', newValue: 'Confirmado' },
  { id: 'a3', date: '2026-03-15 14:00', user: 'Admin', action: 'Alta Producto', element: 'Medialunas x6', previousValue: '-', newValue: '-' },
  { id: 'a4', date: '2026-03-14 10:45', user: 'María García', action: 'Edición Stock Almacén Quincho Bar', element: 'Cerveza Quilmes Lata', previousValue: '48', newValue: '72' },
  { id: 'a5', date: '2026-03-13 16:20', user: 'Admin', action: 'Creación Pedido PED-002', element: 'PED-002', previousValue: '-', newValue: 'Enviado' },
  { id: 'a6', date: '2026-03-12 11:00', user: 'Juan Pérez', action: 'Edición Stock Almacén Kiosco Cancha', element: 'Agua Mineral 500ml', previousValue: '24', newValue: '36' },
];

export const initialUsers: AppUser[] = [
  { id: 'u1', name: 'Admin', email: 'admin@lachacra.com', role: 'Admin' },
  { id: 'u2', name: 'Juan Pérez', email: 'juan@lachacra.com', role: 'Operador' },
  { id: 'u3', name: 'María García', email: 'maria@lachacra.com', role: 'Operador' },
  { id: 'u4', name: 'Carlos López', email: 'carlos@lachacra.com', role: 'Viewer' },
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
  const [currentUser, setCurrentUser] = useLocalStorage<CurrentUser>('stock-current-user', { username: 'admin', role: 'Admin' });
  const [users, setUsers] = useLocalStorage<AppUser[]>('stock-users', initialUsers);

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
    currentUser, setCurrentUser,
    users, setUsers,
    addAudit, getTotalStock, getWarehouseTotalProducts,
  };
}

export type AppState = ReturnType<typeof useAppState>;

export function getUnitLabel(unit: Product['unit'], short = false): string {
  if (unit === 'kg') return 'kg';
  return short ? 'uds' : 'unidades';
}