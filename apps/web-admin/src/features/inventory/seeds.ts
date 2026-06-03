import type { AuditEntry, Category, Order, Product, Supplier, Warehouse } from './types';

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
