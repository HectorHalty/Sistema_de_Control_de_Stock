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
  warehouses: { id: string; name: string; location: string; icon?: string | null }[];
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
  categories: { id: string; name: string; icon?: string | null }[];
  orderCounters: { id: string; valor: number }[];
  ticketCounters: { id: string; valor: number }[];
  users: { id: string; name: string; username: string }[];
  kitchens: { id: string; name: string; active: boolean; emoji?: string | null }[];
  salesProducts: {
    id: string;
    name: string;
    category: string;
    kitchenId: string;
    price: number;
    kind: string;
    active: boolean;
    emoji?: string;
  }[];
  recipes: { id: string; salesProductId: string; stockProductId: string; quantity: number }[];
  bundleItems: { id: string; promoProductId: string; componentProductId: string; quantity: number }[];
  tickets: {
    id: string;
    number: number;
    status: string;
    total: number;
    operatorId: string;
    note: string | null;
    idempotencyKey: string | null;
    stockAllocations: unknown;
    createdAt: Date;
  }[];
  ticketItems: {
    id: string;
    ticketId: string;
    salesProductId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    stockAllocations: unknown;
  }[];
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
    orderCounters: [{ id: 'default', valor: 0 }],
    ticketCounters: [{ id: 'default', valor: 1000 }],
    users: [{ id: 'op-1', name: 'Admin', username: 'admin' }],
    kitchens: [{ id: 'k-1', name: 'Barra', active: true, emoji: '🍹' }],
    salesProducts: [],
    recipes: [],
    bundleItems: [],
    tickets: [],
    ticketItems: [],
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

export class MockPrismaUniqueError extends Error {
  code = 'P2002';
  constructor(message = 'Unique constraint failed') {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
  }
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
        if (state.suppliers.some(s => s.name === data.name)) {
          throw new MockPrismaUniqueError();
        }
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
      update: async ({ where, data, include }: { where: { id: string }; data: { status?: string; receivedAt?: Date; provider?: string; supplierId?: string | null }; include?: { items: boolean } }) => {
        const order = state.purchaseOrders.find(o => o.id === where.id);
        if (!order) throw new Error('not found');
        if (data.status) order.status = data.status;
        if (data.receivedAt) order.receivedAt = data.receivedAt;
        if (data.provider !== undefined) order.provider = data.provider;
        if (data.supplierId !== undefined) order.supplierId = data.supplierId;
        order.updatedAt = new Date();
        if (include?.items) {
          return { ...order, items: state.purchaseOrderItems.filter(i => i.purchaseOrderId === order.id) };
        }
        return order;
      },
    },
    purchaseOrderItem: {
      update: async ({ where, data }: { where: { id: string }; data: { quantityReceived?: number; quantityOrdered?: number } }) => {
        const item = state.purchaseOrderItems.find(i => i.id === where.id);
        if (!item) throw new Error('not found');
        if (data.quantityReceived !== undefined) item.quantityReceived = data.quantityReceived;
        if (data.quantityOrdered !== undefined) item.quantityOrdered = data.quantityOrdered;
        return item;
      },
      deleteMany: async ({ where }: { where: { purchaseOrderId: string; productId?: { notIn: string[] } } }) => {
        const before = state.purchaseOrderItems.length;
        state.purchaseOrderItems = state.purchaseOrderItems.filter(i => {
          if (i.purchaseOrderId !== where.purchaseOrderId) return true;
          if (where.productId?.notIn && where.productId.notIn.includes(i.productId)) return true;
          if (where.productId?.notIn) return false;
          return false;
        });
        return { count: before - state.purchaseOrderItems.length };
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { purchaseOrderId_productId: { purchaseOrderId: string; productId: string } };
        create: { purchaseOrderId: string; productId: string; quantityOrdered: number };
        update: { quantityOrdered: number };
      }) => {
        const existing = state.purchaseOrderItems.find(
          i => i.purchaseOrderId === where.purchaseOrderId_productId.purchaseOrderId
            && i.productId === where.purchaseOrderId_productId.productId,
        );
        if (existing) {
          existing.quantityOrdered = update.quantityOrdered;
          return existing;
        }
        const row = {
          id: randomUUID(),
          purchaseOrderId: create.purchaseOrderId,
          productId: create.productId,
          quantityOrdered: create.quantityOrdered,
          quantityReceived: null as number | null,
        };
        state.purchaseOrderItems.push(row);
        return row;
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
      findMany: async (args?: { orderBy?: { name: string } }) => {
        const rows = [...state.categories];
        if (args?.orderBy?.name === 'asc') rows.sort((a, b) => a.name.localeCompare(b.name));
        return rows;
      },
      findUnique: async ({ where }: { where: { id?: string; name?: string } }) => {
        if (where.id) return state.categories.find(c => c.id === where.id) ?? null;
        if (where.name) return state.categories.find(c => c.name === where.name) ?? null;
        return null;
      },
      create: async ({ data }: { data: { name: string; icon?: string } }) => {
        if (state.categories.some(c => c.name === data.name)) {
          throw new MockPrismaUniqueError();
        }
        const row = { id: randomUUID(), name: data.name, icon: data.icon ?? null };
        state.categories.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: { name?: string; icon?: string } }) => {
        const row = state.categories.find(c => c.id === where.id);
        if (!row) throw new Error('not found');
        if (data.name && state.categories.some(c => c.name === data.name && c.id !== where.id)) {
          throw new MockPrismaUniqueError();
        }
        if (data.name) row.name = data.name;
        if (data.icon !== undefined) row.icon = data.icon;
        return row;
      },
    },
    warehouse: {
      findMany: async (args?: { orderBy?: { name: string } }) => {
        const rows = [...state.warehouses];
        if (args?.orderBy?.name === 'asc') rows.sort((a, b) => a.name.localeCompare(b.name));
        return rows;
      },
      findFirst: async () => state.warehouses[0] ?? null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.warehouses.find(w => w.id === where.id) ?? null,
      create: async ({ data }: { data: { name: string; location: string; icon?: string } }) => {
        if (state.warehouses.some(w => w.name === data.name)) throw new MockPrismaUniqueError();
        const row = {
          id: randomUUID(),
          name: data.name,
          location: data.location,
          icon: data.icon ?? null,
        };
        state.warehouses.push(row);
        return { ...row };
      },
      update: async ({ where, data }: { where: { id: string }; data: { name?: string; location?: string; icon?: string | null } }) => {
        const row = state.warehouses.find(w => w.id === where.id);
        if (!row) throw new Error('not found');
        if (data.name && state.warehouses.some(w => w.name === data.name && w.id !== where.id)) {
          throw new MockPrismaUniqueError();
        }
        if (data.name) row.name = data.name;
        if (data.location) row.location = data.location;
        if (data.icon !== undefined) row.icon = data.icon;
        return { ...row };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = state.warehouses.findIndex(w => w.id === where.id);
        if (idx < 0) throw new Error('not found');
        state.stockLevels = state.stockLevels.filter(s => s.warehouseId !== where.id);
        const [removed] = state.warehouses.splice(idx, 1);
        return removed;
      },
    },
    product: {
      findMany: async (args?: { include?: { category?: boolean; stockLevels?: boolean | { include?: { warehouse: boolean } } }; where?: { categoryId?: string } }) => {
        let rows = [...state.products];
        return rows.map(p => ({
          ...p,
          category: state.categories[0] ?? null,
          stockLevels: state.stockLevels.filter(s => s.productId === p.id).map(s => ({
            ...s,
            warehouse: state.warehouses.find(w => w.id === s.warehouseId) ?? null,
          })),
        }));
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.products.find(p => p.id === where.id) ?? null,
      create: async ({ data, include }: { data: Record<string, unknown>; include?: { stockLevels?: boolean } }) => {
        const id = randomUUID();
        const row = {
          id,
          name: data.name as string,
          code: data.code as string,
          description: (data.description as string | null | undefined) ?? null,
          unit: (data.unit as string) || 'unidades',
          orderUnit: (data.orderUnit as number | null | undefined) ?? null,
          image: (data.image as string | null | undefined) ?? null,
          categoryId: data.categoryId as string,
        };
        state.products.push(row);
        if (include?.stockLevels) return { ...row, stockLevels: [] };
        return row;
      },
      update: async ({ where, data, include }: { where: { id: string }; data: Record<string, unknown>; include?: { stockLevels?: boolean | { include?: { warehouse: boolean } } } }) => {
        const row = state.products.find(p => p.id === where.id) as Record<string, unknown> | undefined;
        if (!row) throw new Error('not found');
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) row[key] = value;
        }
        const stockLevels = state.stockLevels.filter(s => s.productId === where.id).map(s => ({
          ...s,
          warehouse: state.warehouses.find(w => w.id === s.warehouseId) ?? null,
        }));
        if (include?.stockLevels) return { ...row, stockLevels };
        return { ...row };
      },
    },
    stockLevel: {
      findUnique: async ({ where }: { where: { id?: string; productId_warehouseId?: { productId: string; warehouseId: string } } }) => {
        if (where.id) return state.stockLevels.find(s => s.id === where.id) ?? null;
        if (where.productId_warehouseId) {
          const { productId, warehouseId } = where.productId_warehouseId;
          return state.stockLevels.find(s => s.productId === productId && s.warehouseId === warehouseId) ?? null;
        }
        return null;
      },
      findMany: async ({ where, orderBy }: { where?: { productId?: string | { in: string[] } }; orderBy?: unknown } = {}) => {
        let rows = [...state.stockLevels];
        if (where?.productId) {
          if (typeof where.productId === 'string') rows = rows.filter(s => s.productId === where.productId);
          else rows = rows.filter(s => where.productId && typeof where.productId !== 'string' && where.productId.in.includes(s.productId));
        }
        return rows;
      },
      create: async ({ data, include }: { data: { productId: string; warehouseId: string; quantity: number }; include?: { warehouse?: boolean } }) => {
        const row = { id: randomUUID(), ...data };
        state.stockLevels.push(row);
        if (include?.warehouse) {
          return { ...row, warehouse: state.warehouses.find(w => w.id === data.warehouseId) ?? null };
        }
        return row;
      },
      update: async ({ where, data, include }: { where: { id: string }; data: { quantity: number }; include?: { warehouse?: boolean } }) => {
        const row = state.stockLevels.find(s => s.id === where.id);
        if (!row) throw new Error('not found');
        row.quantity = data.quantity;
        if (include?.warehouse) {
          return { ...row, warehouse: state.warehouses.find(w => w.id === row.warehouseId) ?? null };
        }
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
      findMany: async (args?: { take?: number; orderBy?: { createdAt: string }; where?: { productId?: string; type?: string; reference?: string } }) => {
        let rows = [...state.stockMovements];
        if (args?.where?.productId) rows = rows.filter(r => r.productId === args.where!.productId);
        if (args?.where?.type) rows = rows.filter(r => r.type === args.where!.type);
        if (args?.where?.reference) rows = rows.filter(r => r.reference === args.where!.reference);
        if (args?.orderBy?.createdAt === 'desc') rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (args?.take) rows = rows.slice(0, args.take);
        return rows;
      },
    },
    usuario: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.users.find(u => u.id === where.id) ?? null,
    },
    cocina: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: { id?: { in: string[] }; active?: boolean };
        orderBy?: { name: string };
      } = {}) => {
        let rows = [...state.kitchens];
        if (where?.id?.in) rows = rows.filter(k => where.id!.in.includes(k.id));
        if (where?.active !== undefined) rows = rows.filter(k => k.active === where.active);
        if (orderBy?.name === 'asc') rows.sort((a, b) => a.name.localeCompare(b.name));
        return rows;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.kitchens.find(k => k.id === where.id) ?? null,
      create: async ({ data }: { data: { name: string; emoji?: string; active?: boolean } }) => {
        const row = {
          id: randomUUID(),
          name: data.name,
          emoji: data.emoji ?? '🍽️',
          active: data.active ?? true,
        };
        state.kitchens.push(row);
        return { ...row };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { name?: string; emoji?: string; active?: boolean };
      }) => {
        const row = state.kitchens.find(k => k.id === where.id);
        if (!row) throw new Error('not found');
        if (data.name !== undefined) row.name = data.name;
        if (data.emoji !== undefined) row.emoji = data.emoji;
        if (data.active !== undefined) row.active = data.active;
        return { ...row };
      },
    },
    productoVenta: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: { id?: { in: string[] }; active?: boolean };
        include?: unknown;
        orderBy?: { name: string };
      } = {}) => {
        let rows = [...state.salesProducts];
        if (where?.id?.in) rows = rows.filter(p => where.id!.in.includes(p.id));
        if (where?.active !== undefined) rows = rows.filter(p => p.active === where.active);
        if (orderBy?.name === 'asc') rows.sort((a, b) => a.name.localeCompare(b.name));
        return rows.map(p => ({
          ...p,
          recipe: state.recipes.filter(r => r.salesProductId === p.id).map(r => ({
            ...r,
            stockProduct: state.products.find(sp => sp.id === r.stockProductId) ?? null,
          })),
          bundleItems: state.bundleItems.filter(b => b.promoProductId === p.id).map(b => ({
            ...b,
            componentProduct: state.salesProducts.find(sp => sp.id === b.componentProductId) ?? null,
          })),
        }));
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const p = state.salesProducts.find(s => s.id === where.id);
        if (!p) return null;
        return {
          ...p,
          recipe: state.recipes.filter(r => r.salesProductId === p.id).map(r => ({
            ...r,
            stockProduct: state.products.find(sp => sp.id === r.stockProductId) ?? null,
          })),
          bundleItems: state.bundleItems.filter(b => b.promoProductId === p.id).map(b => ({
            ...b,
            componentProduct: state.salesProducts.find(sp => sp.id === b.componentProductId) ?? null,
          })),
        };
      },
      create: async ({ data }: { data: Record<string, unknown>; include?: unknown }) => {
        const id = randomUUID();
        const row = {
          id,
          name: data.name as string,
          category: data.category as string,
          kitchenId: data.kitchenId as string,
          price: Number(data.price),
          kind: (data.kind as string) || 'simple',
          active: true,
          emoji: (data.emoji as string | undefined) ?? null,
        };
        state.salesProducts.push(row);
        const recipeCreate = (data.recipe as { create?: Array<{ stockProductId: string; quantity: number }> })?.create ?? [];
        for (const r of recipeCreate) {
          state.recipes.push({ id: randomUUID(), salesProductId: id, ...r });
        }
        const bundleCreate = (data.bundleItems as { create?: Array<{ componentProductId: string; quantity: number }> })?.create ?? [];
        for (const b of bundleCreate) {
          state.bundleItems.push({ id: randomUUID(), promoProductId: id, ...b });
        }
        return {
          ...row,
          recipe: state.recipes.filter(r => r.salesProductId === id).map(r => ({
            ...r,
            stockProduct: state.products.find(sp => sp.id === r.stockProductId) ?? null,
          })),
          bundleItems: state.bundleItems.filter(b => b.promoProductId === id).map(b => ({
            ...b,
            componentProduct: state.salesProducts.find(sp => sp.id === b.componentProductId) ?? null,
          })),
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const p = state.salesProducts.find(s => s.id === where.id);
        if (!p) throw new Error('not found');
        if (data.name !== undefined) p.name = data.name as string;
        if (data.category !== undefined) p.category = data.category as string;
        if (data.kitchenId !== undefined) p.kitchenId = data.kitchenId as string;
        if (data.price !== undefined) p.price = Number(data.price);
        if (data.kind !== undefined) p.kind = data.kind as string;
        if (data.active !== undefined) p.active = Boolean(data.active);
        if (data.emoji !== undefined) p.emoji = data.emoji as string;
        return {
          ...p,
          recipe: state.recipes.filter(r => r.salesProductId === p.id),
          bundleItems: state.bundleItems.filter(b => b.promoProductId === p.id),
        };
      },
    },
    ticketVenta: {
      findUnique: async ({ where, include }: { where: { id?: string; idempotencyKey?: string }; include?: { items?: boolean; operator?: unknown } }) => {
        const ticket = where.idempotencyKey
          ? state.tickets.find(t => t.idempotencyKey === where.idempotencyKey)
          : state.tickets.find(t => t.id === where.id);
        if (!ticket) return null;
        return {
          ...ticket,
          items: include?.items ? state.ticketItems.filter(i => i.ticketId === ticket.id) : undefined,
          operator: state.users.find(u => u.id === ticket.operatorId) ?? null,
        };
      },
      findFirst: async ({ where }: { where: { idempotencyKey?: string } }) =>
        state.tickets.find(t => t.idempotencyKey === where.idempotencyKey) ?? null,
      create: async ({ data, include }: { data: Record<string, unknown>; include?: { items?: boolean; operator?: unknown } }) => {
        if (data.idempotencyKey && state.tickets.some(t => t.idempotencyKey === data.idempotencyKey)) {
          throw new MockPrismaUniqueError();
        }
        const id = randomUUID();
        const ticket = {
          id,
          number: data.number as number,
          status: data.status as string,
          total: Number(data.total),
          operatorId: data.operatorId as string,
          note: (data.note as string | null) ?? null,
          idempotencyKey: (data.idempotencyKey as string | null) ?? null,
          stockAllocations: data.stockAllocations ?? null,
          createdAt: new Date(),
        };
        state.tickets.push(ticket);
        const itemsCreate = (data.items as { create: Array<Record<string, unknown>> })?.create ?? [];
        for (const item of itemsCreate) {
          state.ticketItems.push({
            id: randomUUID(),
            ticketId: id,
            salesProductId: item.salesProductId as string,
            name: item.name as string,
            unitPrice: Number(item.unitPrice),
            quantity: item.quantity as number,
            stockAllocations: item.stockAllocations ?? null,
          });
        }
        return {
          ...ticket,
          items: include?.items ? state.ticketItems.filter(i => i.ticketId === id) : undefined,
          operator: state.users.find(u => u.id === ticket.operatorId) ?? null,
        };
      },
      update: async ({ where, data, include }: { where: { id: string }; data: Record<string, unknown>; include?: { items?: boolean; operator?: unknown } }) => {
        const ticket = state.tickets.find(t => t.id === where.id);
        if (!ticket) throw new Error('not found');
        if (data.status) ticket.status = data.status as string;
        if (data.total !== undefined) ticket.total = Number(data.total);
        if (data.stockAllocations !== undefined) ticket.stockAllocations = data.stockAllocations;
        return {
          ...ticket,
          items: include?.items ? state.ticketItems.filter(i => i.ticketId === ticket.id) : undefined,
          operator: state.users.find(u => u.id === ticket.operatorId) ?? { username: 'admin' },
        };
      },
    },
    itemTicketVenta: {
      findMany: async ({ where }: { where?: { salesProductId?: { in: string[] }; ticket?: { status: string } } } = {}) => {
        let rows = [...state.ticketItems];
        if (where?.salesProductId?.in) rows = rows.filter(i => where.salesProductId!.in.includes(i.salesProductId));
        if (where?.ticket?.status) {
          rows = rows.filter(i => {
            const t = state.tickets.find(x => x.id === i.ticketId);
            return t?.status === where.ticket!.status;
          });
        }
        return rows;
      },
      deleteMany: async ({ where }: { where: { ticketId: string } }) => {
        const before = state.ticketItems.length;
        state.ticketItems = state.ticketItems.filter(i => i.ticketId !== where.ticketId);
        return { count: before - state.ticketItems.length };
      },
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        for (const item of data) {
          state.ticketItems.push({
            id: randomUUID(),
            ticketId: item.ticketId as string,
            salesProductId: item.salesProductId as string,
            name: item.name as string,
            unitPrice: Number(item.unitPrice),
            quantity: item.quantity as number,
            stockAllocations: item.stockAllocations ?? null,
          });
        }
        return { count: data.length };
      },
    },
    ordenCocina: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: randomUUID(), ...data }),
      deleteMany: async ({ where }: { where: { ticketId: string } }) => {
        return { count: 0, ticketId: where.ticketId };
      },
    },
    contadorPedido: {
      upsert: async ({
        where,
        create,
      }: {
        where: { id: string };
        create: { id: string; valor: number };
        update: object;
      }) => {
        let row = state.orderCounters.find(c => c.id === where.id);
        if (!row) {
          row = { id: create.id, valor: create.valor };
          state.orderCounters.push(row);
        }
        return { ...row };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { valor?: number | { increment: number } };
      }) => {
        const row = state.orderCounters.find(c => c.id === where.id);
        if (!row) throw new Error('contadorPedido not found');
        if (typeof data.valor === 'object' && data.valor && 'increment' in data.valor) {
          row.valor += data.valor.increment;
        } else if (typeof data.valor === 'number') {
          row.valor = data.valor;
        }
        return { ...row };
      },
    },
    contadorTicket: {
      upsert: async ({
        where,
        create,
      }: {
        where: { id: string };
        create: { id: string; valor: number };
        update: object;
      }) => {
        let row = state.ticketCounters.find(c => c.id === where.id);
        if (!row) {
          row = { id: create.id, valor: create.valor };
          state.ticketCounters.push(row);
        }
        return { ...row };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { valor?: number | { increment: number } };
      }) => {
        const row = state.ticketCounters.find(c => c.id === where.id);
        if (!row) throw new Error('contadorTicket not found');
        if (typeof data.valor === 'object' && data.valor && 'increment' in data.valor) {
          row.valor += data.valor.increment;
        } else if (typeof data.valor === 'number') {
          row.valor = data.valor;
        }
        return { ...row };
      },
    },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(' ').replace(/\s+/g, ' ').toLowerCase();
      if (sql.includes('pg_advisory')) return [];
      if (sql.includes('niveles_stock') && sql.includes('for update') && sql.includes('where id')) {
        const id = values[0] as string;
        return state.stockLevels.filter(s => s.id === id).map(s => ({ id: s.id }));
      }
      if (sql.includes('niveles_stock') && (sql.includes('for update') || sql.includes('productid'))) {
        const ids = (values[0] as string[] | undefined) ?? [];
        const rows = ids.length
          ? state.stockLevels.filter(s => ids.includes(s.productId))
          : state.stockLevels;
        return [...rows]
          .sort((a, b) => a.productId.localeCompare(b.productId) || a.warehouseId.localeCompare(b.warehouseId))
          .map(s => ({
            productId: s.productId,
            warehouseId: s.warehouseId,
            quantity: s.quantity,
            productName: state.products.find(p => p.id === s.productId)?.name,
          }));
      }
      if (sql.includes('tickets_venta') && sql.includes('for update')) {
        return [{ id: values[0] }];
      }
      if (sql.includes('items_ticket_venta') && sql.includes('sum')) {
        const agg = new Map<string, { status: string; salesProductId: string; qty: number }>();
        for (const t of state.tickets) {
          if (t.status !== 'emitido' && t.status !== 'devuelto') continue;
          for (const i of state.ticketItems.filter(x => x.ticketId === t.id)) {
            const key = `${t.status}::${i.salesProductId}`;
            const prev = agg.get(key);
            if (prev) prev.qty += i.quantity;
            else agg.set(key, { status: t.status, salesProductId: i.salesProductId, qty: i.quantity });
          }
        }
        return [...agg.values()];
      }
      return [];
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(' ').replace(/\s+/g, ' ').toLowerCase();
      if (sql.includes('pg_advisory')) return 0;
      if (sql.includes('update') && sql.includes('niveles_stock')) {
        const delta = Number(values[0]);
        if (sql.includes('warehouseid') || sql.includes('"warehouseid"')) {
          const productId = values[1] as string;
          const warehouseId = values[2] as string;
          const row = state.stockLevels.find(s => s.productId === productId && s.warehouseId === warehouseId);
          if (!row) return 0;
          row.quantity = Math.round((row.quantity + delta) * 1000) / 1000;
          return 1;
        }
        if (sql.includes('where id')) {
          const id = values[1] as string;
          const row = state.stockLevels.find(s => s.id === id);
          if (!row) return 0;
          row.quantity = Math.round((row.quantity + delta) * 1000) / 1000;
          return 1;
        }
      }
      return 1;
    },
    $transaction: async <T>(fn: (tx: typeof client) => Promise<T>): Promise<T> => {
      transactionCount++;
      return fn(client);
    },
  };

  // Accessors Prisma en español (mismo comportamiento)
  Object.assign(client, {
    proveedor: client.supplier,
    proveedorProducto: client.supplierProduct,
    ordenCompra: client.purchaseOrder,
    itemOrdenCompra: client.purchaseOrderItem,
    nivelStock: client.stockLevel,
    movimientoStock: client.stockMovement,
    producto: client.product,
    deposito: client.warehouse,
    consumoEmpleado: client.employeeConsumption,
    sesionConteo: client.stockCountSession,
    categoria: client.category,
    contadorPedido: client.contadorPedido,
    contadorTicket: client.contadorTicket,
  });

  return client;
}

export { stockLevelKey };
