import { randomUUID } from 'crypto';

/**
 * Store en memoria para tests de integración del módulo stock.
 * Simula Prisma con transacciones síncronas (mismo objeto para tx y prisma).
 */
export interface StockTestState {
  suppliers: { id: string; name: string; createdAt: Date; updatedAt: Date }[];
  supplierProducts: { id: string; supplierId: string; productId: string; createdAt: Date }[];
  purchaseOrders: {
    id: string;
    orderNumber: string;
    date: string;
    provider: string;
    supplierId: string | null;
    status: string;
    receivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  purchaseOrderItems: {
    id: string;
    purchaseOrderId: string;
    productId: string;
    quantityOrdered: number;
    quantityReceived: number | null;
  }[];
  products: { id: string; name: string; code: string; unit: string }[];
  warehouses: { id: string; name: string; location: string }[];
  stockLevels: { id: string; productId: string; warehouseId: string; quantity: number }[];
  stockMovements: {
    id: string;
    type: string;
    productId: string;
    warehouseId: string | null;
    quantity: number;
    reference: string | null;
    operatorId: string | null;
    operatorName: string | null;
    createdAt: Date;
  }[];
  employeeConsumptions: unknown[];
  stockCountSessions: unknown[];
  categories: { id: string; name: string }[];
}

export function createEmptyStockState(): StockTestState {
  return {
    suppliers: [],
    supplierProducts: [],
    purchaseOrders: [],
    purchaseOrderItems: [],
    products: [],
    warehouses: [],
    stockLevels: [],
    stockMovements: [],
    employeeConsumptions: [],
    stockCountSessions: [],
    categories: [],
  };
}

export function seedBasicCatalog(state: StockTestState) {
  const catId = randomUUID();
  state.categories.push({ id: catId, name: 'Bebidas' });
  const whId = randomUUID();
  state.warehouses.push({ id: whId, name: 'Depósito', location: 'PB' });
  const p1 = randomUUID();
  const p2 = randomUUID();
  state.products.push(
    { id: p1, name: 'Coca 500ml', code: 'BEB-001', unit: 'unidades' },
    { id: p2, name: 'Agua 500ml', code: 'BEB-002', unit: 'unidades' },
  );
  state.stockLevels.push(
    { id: randomUUID(), productId: p1, warehouseId: whId, quantity: 10 },
    { id: randomUUID(), productId: p2, warehouseId: whId, quantity: 5 },
  );
  return { catId, whId, p1, p2 };
}

function stockLevelKey(productId: string, warehouseId: string) {
  return `${productId}::${warehouseId}`;
}

export function createPrismaMock(state: StockTestState) {
  let transactionCount = 0;

  const client = {
    get transactionCount() {
      return transactionCount;
    },
    supplier: {
      findMany: async (args?: { orderBy?: { name: string } }) => {
        let rows = state.suppliers.map(s => ({
          ...s,
          products: state.supplierProducts.filter(sp => sp.supplierId === s.id),
        }));
        if (args?.orderBy?.name === 'asc') {
          rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
        }
        return rows;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.suppliers.find(s => s.id === where.id) ?? null,
      create: async ({ data, include }: { data: { name: string; products?: { create: { productId: string }[] } }; include?: { products: boolean } }) => {
        const id = randomUUID();
        const now = new Date();
        state.suppliers.push({ id, name: data.name, createdAt: now, updatedAt: now });
        if (data.products?.create) {
          for (const row of data.products.create) {
            state.supplierProducts.push({
              id: randomUUID(),
              supplierId: id,
              productId: row.productId,
              createdAt: now,
            });
          }
        }
        const supplier = state.suppliers.find(s => s.id === id)!;
        if (include?.products) {
          return { ...supplier, products: state.supplierProducts.filter(sp => sp.supplierId === id) };
        }
        return supplier;
      },
      update: async ({ where, data, include }: { where: { id: string }; data: { name?: string }; include?: { products: boolean } }) => {
        const s = state.suppliers.find(x => x.id === where.id);
        if (!s) throw new Error('not found');
        if (data.name) s.name = data.name;
        s.updatedAt = new Date();
        if (include?.products) {
          return { ...s, products: state.supplierProducts.filter(sp => sp.supplierId === s.id) };
        }
        return s;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = state.suppliers.findIndex(s => s.id === where.id);
        if (idx < 0) throw new Error('not found');
        const [removed] = state.suppliers.splice(idx, 1);
        state.supplierProducts = state.supplierProducts.filter(sp => sp.supplierId !== where.id);
        return removed;
      },
    },
    supplierProduct: {
      deleteMany: async ({ where }: { where: { supplierId: string } }) => {
        const before = state.supplierProducts.length;
        state.supplierProducts = state.supplierProducts.filter(sp => sp.supplierId !== where.supplierId);
        return { count: before - state.supplierProducts.length };
      },
      createMany: async ({ data }: { data: { supplierId: string; productId: string }[] }) => {
        const now = new Date();
        for (const row of data) {
          state.supplierProducts.push({ id: randomUUID(), ...row, createdAt: now });
        }
        return { count: data.length };
      },
    },
    purchaseOrder: {
      findMany: async (args?: { select?: { orderNumber: boolean }; orderBy?: { createdAt: string }; take?: number; where?: { status?: string }; include?: { items: boolean } }) => {
        let rows = [...state.purchaseOrders];
        if (args?.where?.status) rows = rows.filter(o => o.status === args.where!.status);
        if (args?.orderBy?.createdAt === 'desc') rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (args?.take) rows = rows.slice(0, args.take);
        if (args?.select?.orderNumber) {
          return rows.map(o => ({ orderNumber: o.orderNumber }));
        }
        if (args?.include?.items) {
          return rows.map(o => ({
            ...o,
            items: state.purchaseOrderItems.filter(i => i.purchaseOrderId === o.id),
          }));
        }
        return rows;
      },
      findFirst: async ({ where, include }: { where: { OR: { id?: string; orderNumber?: string }[] }; include?: { items: boolean } }) => {
        const id = where.OR.find(o => o.id)?.id;
        const orderNumber = where.OR.find(o => o.orderNumber)?.orderNumber;
        const order = state.purchaseOrders.find(
          o => o.id === id || o.orderNumber === orderNumber || o.id === orderNumber || o.orderNumber === id,
        );
        if (!order) return null;
        if (include?.items) {
          return { ...order, items: state.purchaseOrderItems.filter(i => i.purchaseOrderId === order.id) };
        }
        return order;
      },
      create: async ({ data, include }: { data: Record<string, unknown>; include?: { items: boolean } }) => {
        const id = randomUUID();
        const now = new Date();
        const order = {
          id,
          orderNumber: data.orderNumber as string,
          date: data.date as string,
          provider: data.provider as string,
          supplierId: (data.supplierId as string | null) ?? null,
          status: data.status as string,
          receivedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        state.purchaseOrders.push(order);
        const itemsCreate = (data.items as { create: { productId: string; quantityOrdered: number }[] })?.create ?? [];
        for (const item of itemsCreate) {
          state.purchaseOrderItems.push({
            id: randomUUID(),
            purchaseOrderId: id,
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: null,
          });
        }
        if (include?.items) {
          return { ...order, items: state.purchaseOrderItems.filter(i => i.purchaseOrderId === id) };
        }
        return order;
      },
      update: async ({ where, data, include }: { where: { id: string }; data: { status?: string; receivedAt?: Date }; include?: { items: boolean } }) => {
        const order = state.purchaseOrders.find(o => o.id === where.id);
        if (!order) throw new Error('not found');
        if (data.status) order.status = data.status;
        if (data.receivedAt) order.receivedAt = data.receivedAt;
        order.updatedAt = new Date();
        if (include?.items) {
          return { ...order, items: state.purchaseOrderItems.filter(i => i.purchaseOrderId === order.id) };
        }
        return order;
      },
    },
    purchaseOrderItem: {
      update: async ({ where, data }: { where: { id: string }; data: { quantityReceived: number } }) => {
        const item = state.purchaseOrderItems.find(i => i.id === where.id);
        if (!item) throw new Error('not found');
        item.quantityReceived = data.quantityReceived;
        return item;
      },
    },
    stockLevel: {
      findUnique: async ({ where }: { where: { productId_warehouseId: { productId: string; warehouseId: string } } }) => {
        const { productId, warehouseId } = where.productId_warehouseId;
        return state.stockLevels.find(s => s.productId === productId && s.warehouseId === warehouseId) ?? null;
      },
      create: async ({ data }: { data: { productId: string; warehouseId: string; quantity: number } }) => {
        const row = { id: randomUUID(), ...data };
        state.stockLevels.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: { quantity: number } }) => {
        const row = state.stockLevels.find(s => s.id === where.id);
        if (!row) throw new Error('not found');
        row.quantity = data.quantity;
        return row;
      },
      deleteMany: async ({ where }: { where: { warehouseId: string } }) => {
        const before = state.stockLevels.length;
        state.stockLevels = state.stockLevels.filter(s => s.warehouseId !== where.warehouseId);
        return { count: before - state.stockLevels.length };
      },
    },
    stockMovement: {
      createMany: async ({ data }: { data: { type: string; productId: string; warehouseId: string | null; quantity: number; reference: string | null; operatorId: string | null; operatorName: string | null }[] }) => {
        const now = new Date();
        for (const row of data) {
          state.stockMovements.push({ id: randomUUID(), ...row, createdAt: now });
        }
        return { count: data.length };
      },
      findMany: async (args?: { take?: number; orderBy?: { createdAt: string } }) => {
        let rows = [...state.stockMovements];
        if (args?.orderBy?.createdAt === 'desc') rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (args?.take) rows = rows.slice(0, args.take);
        return rows;
      },
    },
    product: {
      findMany: async () => state.products,
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.products.find(p => p.id === where.id) ?? null,
    },
    warehouse: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.warehouses.find(w => w.id === where.id) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = state.warehouses.findIndex(w => w.id === where.id);
        if (idx < 0) throw new Error('not found');
        const [removed] = state.warehouses.splice(idx, 1);
        return removed;
      },
    },
    employeeConsumption: {
      findMany: async () => state.employeeConsumptions,
      create: async ({ data }: { data: unknown }) => {
        const row = { id: randomUUID(), ...(data as object) };
        state.employeeConsumptions.push(row);
        return row;
      },
    },
    stockCountSession: {
      findMany: async () => state.stockCountSessions,
      create: async ({ data }: { data: unknown }) => {
        const row = { id: randomUUID(), ...(data as object) };
        state.stockCountSessions.push(row);
        return row;
      },
    },
    category: {
      findMany: async () => state.categories,
    },
    $transaction: async <T>(fn: (tx: typeof client) => Promise<T>): Promise<T> => {
      transactionCount++;
      return fn(client);
    },
  };

  return client;
}

export { stockLevelKey };
