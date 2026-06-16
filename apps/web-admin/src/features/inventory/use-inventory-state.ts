import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { migrateOrderStatuses } from './sort-orders';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { stockApi } from '@/app/api/client';
import { isApiReachable } from '@/app/api/adapters';
import {
  mapApiProductToLocal,
  mapApiWarehouseToLocal,
  mapApiCategoryToLocal,
  mapApiMovementToLocal,
  mapApiEmployeeConsumptionToLocal,
  mapApiCountSessionToLocal,
  mapApiSupplierToLocal,
  mapApiPurchaseOrderToLocal,
  nextProductCode,
} from './api/inventory-mappers';
import { getCategoryCodePrefix, formatProductCode, reassignProductCodes } from './product-codes';
import {
  initialCategories,
  initialAuditLog,
  initialOrders,
  initialProducts,
  initialSuppliers,
  initialWarehouses,
} from './seeds';
import type { AuditEntry, AuditModule, Category, ConsumptionLog, EmployeeConsumptionEntry, Order, Product, StockCountSession, StockMovement, Supplier, Warehouse } from './types';

function appendAudit(
  setter: Dispatch<SetStateAction<AuditEntry[]>>,
  module: AuditModule,
  entry: Omit<AuditEntry, 'id' | 'date' | 'module'>,
) {
  setter(prev => [{
    ...entry,
    module,
    id: `a${Date.now()}`,
    date: new Date().toLocaleString('es-AR'),
  }, ...prev]);
}

export function useInventoryState() {
  const [products, setProducts] = useLocalStorage<Product[]>(storageKeys.inventory.products, initialProducts);
  const [warehouses, setWarehouses] = useLocalStorage<Warehouse[]>(storageKeys.inventory.warehouses, initialWarehouses);
  const [orders, setOrders] = useLocalStorage<Order[]>(storageKeys.inventory.orders, initialOrders);
  const [auditLog, setAuditLog] = useLocalStorage<AuditEntry[]>(storageKeys.inventory.auditLog, initialAuditLog);
  const [categories, setCategories] = useLocalStorage<Category[]>(storageKeys.inventory.categories, initialCategories);
  const [consumptionLogs, setConsumptionLogs] = useLocalStorage<ConsumptionLog[]>(storageKeys.inventory.consumption, []);
  const [employeeConsumptionLogs, setEmployeeConsumptionLogs] = useLocalStorage<EmployeeConsumptionEntry[]>(
    storageKeys.inventory.employeeConsumption,
    [],
  );
  const [suppliers, setSuppliers] = useLocalStorage<Supplier[]>(storageKeys.inventory.suppliers, initialSuppliers);
  const [stockMovements, setStockMovements] = useLocalStorage<StockMovement[]>(storageKeys.inventory.movements, []);
  const [stockCountSessions, setStockCountSessions] = useLocalStorage<StockCountSession[]>(storageKeys.inventory.countSessions, []);

  // null = aún no chequeado, true = API es fuente de verdad, false = modo local (offline).
  const [inventoryApiAvailable, setInventoryApiAvailable] = useState<boolean | null>(null);
  // Evita que una hidratación inicial en vuelo pise cambios hechos mientras carga.
  const mountHydrationGen = useRef(0);

  const invalidateMountHydration = useCallback(() => {
    mountHydrationGen.current += 1;
  }, []);

  const applyHydration = useCallback((mountGen: number | undefined, apply: () => void) => {
    if (mountGen === undefined || mountGen === mountHydrationGen.current) apply();
  }, []);

  const markApiSynced = useCallback(() => {
    invalidateMountHydration();
    setInventoryApiAvailable(prev => (prev === false ? false : true));
  }, [invalidateMountHydration]);

  useEffect(() => {
    setOrders(prev => {
      const migrated = migrateOrderStatuses(prev);
      return migrated.some((o, i) => o.status !== prev[i].status) ? migrated : prev;
    });
  }, [setOrders]);

  // ============ API-first: hidratación y CRUD del catálogo de stock ============
  // El catálogo (categorías, almacenes, productos + niveles de stock) vive en la
  // API. Al montar, si la API responde, sobrescribimos el caché local con lo del
  // servidor. Si la API no está disponible, seguimos operando contra localStorage.

  const hydrateCategories = useCallback(async (mountGen?: number) => {
    const cats = await stockApi.categories.list();
    applyHydration(mountGen, () => setCategories(cats.map(mapApiCategoryToLocal)));
  }, [setCategories, applyHydration]);

  const hydrateWarehouses = useCallback(async (mountGen?: number) => {
    const whs = await stockApi.warehouses.list();
    applyHydration(mountGen, () => setWarehouses(whs.map(mapApiWarehouseToLocal)));
  }, [setWarehouses, applyHydration]);

  const hydrateProducts = useCallback(async (mountGen?: number) => {
    const prods = await stockApi.products.list();
    const mapped = prods.map(mapApiProductToLocal);
    applyHydration(mountGen, () => setProducts(mapped));
    return mapped;
  }, [setProducts, applyHydration]);

  const hydrateMovements = useCallback(async (mountGen?: number) => {
    const movs = await stockApi.movements.list({ limit: 500 });
    applyHydration(mountGen, () => setStockMovements(movs.map(mapApiMovementToLocal)));
  }, [setStockMovements, applyHydration]);

  const hydrateEmployeeConsumptions = useCallback(async (mountGen?: number) => {
    const rows = await stockApi.employeeConsumptions.list(200);
    applyHydration(mountGen, () => setEmployeeConsumptionLogs(rows.map(mapApiEmployeeConsumptionToLocal)));
  }, [setEmployeeConsumptionLogs, applyHydration]);

  const hydrateCountSessions = useCallback(async (mountGen?: number) => {
    const sessions = await stockApi.countSessions.list(100);
    applyHydration(mountGen, () => setStockCountSessions(sessions.map(mapApiCountSessionToLocal)));
  }, [setStockCountSessions, applyHydration]);

  const hydrateSuppliers = useCallback(async (mountGen?: number) => {
    const rows = await stockApi.suppliers.list();
    applyHydration(mountGen, () => setSuppliers(rows.map(mapApiSupplierToLocal)));
  }, [setSuppliers, applyHydration]);

  const hydrateOrders = useCallback(async (mountGen?: number) => {
    const rows = await stockApi.purchaseOrders.list();
    applyHydration(mountGen, () => setOrders(rows.map(mapApiPurchaseOrderToLocal)));
  }, [setOrders, applyHydration]);

  useEffect(() => {
    let cancelled = false;
    const mountGen = mountHydrationGen.current;
    isApiReachable().then(async ok => {
      if (cancelled) return;
      if (!ok) {
        setInventoryApiAvailable(false);
        return;
      }
      try {
        await Promise.all([
          hydrateCategories(mountGen),
          hydrateWarehouses(mountGen),
          hydrateProducts(mountGen),
          hydrateMovements(mountGen),
          hydrateEmployeeConsumptions(mountGen),
          hydrateCountSessions(mountGen),
          hydrateSuppliers(mountGen),
          hydrateOrders(mountGen),
        ]);
        if (!cancelled && mountGen === mountHydrationGen.current) {
          setInventoryApiAvailable(true);
        }
      } catch {
        if (!cancelled && mountGen === mountHydrationGen.current) {
          setInventoryApiAvailable(false);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    hydrateCategories,
    hydrateWarehouses,
    hydrateProducts,
    hydrateMovements,
    hydrateEmployeeConsumptions,
    hydrateCountSessions,
    hydrateSuppliers,
    hydrateOrders,
  ]);

  const createProduct = useCallback(
    async (input: Product): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setProducts(prev => reassignProductCodes([...prev, { ...input, id: `p${Date.now()}`, code: '' }]));
        return;
      }
      try {
        const categoryId = categories.find(c => c.name === input.category)?.id;
        if (!categoryId) throw new Error(`Categoría no encontrada: ${input.category}`);
        const code = nextProductCode(products, input.category, getCategoryCodePrefix, formatProductCode);
        const created = await stockApi.products.create(
          {
            name: input.name,
            code,
            description: input.description || undefined,
            categoryId,
            unit: input.unit,
            orderUnit: input.orderUnit,
            image: input.image || undefined,
          },
          '',
        );
        for (const s of input.stockByWarehouse) {
          if (s.quantity > 0) {
            await stockApi.products.adjustStock(created.id, s.warehouseId, s.quantity, '');
          }
        }
        markApiSynced();
        setProducts(prev => {
          const mapped = mapApiProductToLocal(created);
          const without = prev.filter(p => p.id !== mapped.id);
          return reassignProductCodes([...without, mapped]);
        });
        await hydrateProducts();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setProducts(prev => reassignProductCodes([...prev, { ...input, id: `p${Date.now()}`, code: '' }]));
      }
    },
    [inventoryApiAvailable, categories, products, hydrateProducts, setProducts, markApiSynced],
  );

  const updateProduct = useCallback(
    async (input: Product, previous: Product): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setProducts(prev => reassignProductCodes(prev.map(p => (p.id === input.id ? input : p))));
        return;
      }
      try {
        const categoryId = categories.find(c => c.name === input.category)?.id;
        if (!categoryId) throw new Error(`Categoría no encontrada: ${input.category}`);
        await stockApi.products.update(
          input.id,
          {
            name: input.name,
            description: input.description || undefined,
            categoryId,
            unit: input.unit,
            orderUnit: input.orderUnit,
            image: input.image || undefined,
          },
          '',
        );
        const warehouseIds = new Set([
          ...input.stockByWarehouse.map(s => s.warehouseId),
          ...previous.stockByWarehouse.map(s => s.warehouseId),
        ]);
        for (const wid of warehouseIds) {
          const after = input.stockByWarehouse.find(s => s.warehouseId === wid)?.quantity ?? 0;
          const before = previous.stockByWarehouse.find(s => s.warehouseId === wid)?.quantity ?? 0;
          const delta = after - before;
          if (delta !== 0) await stockApi.products.adjustStock(input.id, wid, delta, '');
        }
        markApiSynced();
        await hydrateProducts();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setProducts(prev => reassignProductCodes(prev.map(p => (p.id === input.id ? input : p))));
      }
    },
    [inventoryApiAvailable, categories, hydrateProducts, setProducts, markApiSynced],
  );

  const deleteProduct = useCallback(
    async (id: string): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setProducts(prev => reassignProductCodes(prev.filter(p => p.id !== id)));
        return;
      }
      try {
        await stockApi.products.remove(id, '');
        markApiSynced();
        setProducts(prev => reassignProductCodes(prev.filter(p => p.id !== id)));
        await hydrateProducts();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setProducts(prev => reassignProductCodes(prev.filter(p => p.id !== id)));
      }
    },
    [inventoryApiAvailable, hydrateProducts, setProducts, markApiSynced],
  );

  const createCategory = useCallback(
    async (input: { name: string; icon: string }): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setCategories(prev => [...prev, { ...input, id: `cat${Date.now()}` }]);
        return;
      }
      try {
        const created = await stockApi.categories.create(
          { name: input.name, icon: input.icon },
          '',
        );
        markApiSynced();
        const mapped = mapApiCategoryToLocal(created);
        setCategories(prev => {
          const without = prev.filter(
            c => c.id !== mapped.id && c.name.toLowerCase() !== mapped.name.toLowerCase(),
          );
          return [...without, mapped].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        });
        await hydrateCategories();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setCategories(prev => [...prev, { ...input, id: `cat${Date.now()}` }]);
      }
    },
    [inventoryApiAvailable, hydrateCategories, setCategories, markApiSynced],
  );

  const createWarehouse = useCallback(
    async (input: Omit<Warehouse, 'id'>): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setWarehouses(prev => [...prev, { ...input, id: `w${Date.now()}` }]);
        return;
      }
      try {
        const created = await stockApi.warehouses.create(
          { name: input.name, location: input.location, icon: input.icon },
          '',
        );
        markApiSynced();
        const mapped = mapApiWarehouseToLocal(created);
        setWarehouses(prev => {
          const without = prev.filter(
            w => w.id !== mapped.id && w.name.toLowerCase() !== mapped.name.toLowerCase(),
          );
          return [...without, mapped].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        });
        await hydrateWarehouses();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setWarehouses(prev => [...prev, { ...input, id: `w${Date.now()}` }]);
      }
    },
    [inventoryApiAvailable, hydrateWarehouses, setWarehouses, markApiSynced],
  );

  const updateWarehouse = useCallback(
    async (input: Warehouse): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setWarehouses(prev => prev.map(w => (w.id === input.id ? input : w)));
        return;
      }
      try {
        await stockApi.warehouses.update(
          input.id,
          { name: input.name, location: input.location, icon: input.icon },
          '',
        );
        markApiSynced();
        await hydrateWarehouses();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setWarehouses(prev => prev.map(w => (w.id === input.id ? input : w)));
      }
    },
    [inventoryApiAvailable, hydrateWarehouses, setWarehouses, markApiSynced],
  );

  const deleteWarehouse = useCallback(
    async (id: string): Promise<void> => {
      const stripFromLocal = () => {
        setWarehouses(prev => prev.filter(w => w.id !== id));
        setProducts(prev => prev.map(p => ({
          ...p,
          stockByWarehouse: p.stockByWarehouse.filter(s => s.warehouseId !== id),
        })));
      };

      // null = hidratación en curso: intentar API salvo que sepamos que está offline
      if (inventoryApiAvailable !== false) {
        try {
          await stockApi.warehouses.remove(id, '');
          markApiSynced();
          stripFromLocal();
          try {
            await Promise.all([hydrateWarehouses(), hydrateProducts()]);
          } catch {
            // El almacén ya se quitó de la UI; reintentar hidratación de productos después
          }
          return;
        } catch (e) {
          if (inventoryApiAvailable === true) throw e;
        }
      }

      stripFromLocal();
    },
    [inventoryApiAvailable, hydrateWarehouses, hydrateProducts, setWarehouses, setProducts, markApiSynced],
  );

  const addStockAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date' | 'module'>) => {
    appendAudit(setAuditLog, 'stock', entry);
  }, [setAuditLog]);

  const addStockMovements = useCallback(
    (entries: Omit<StockMovement, 'id' | 'createdAtISO'>[], createdAtISO?: string) => {
      // Con API disponible, los movimientos los registra el servidor.
      if (inventoryApiAvailable) return;
      const filtered = entries.filter(e => e.quantity !== 0);
      if (filtered.length === 0) return;
      const ts = createdAtISO ?? new Date().toISOString();
      const movements: StockMovement[] = filtered.map((e, i) => ({
        ...e,
        id: `mov-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        createdAtISO: ts,
      }));
      setStockMovements(prev => [...movements, ...prev]);
    },
    [inventoryApiAvailable, setStockMovements],
  );

  const registerEmployeeConsumption = useCallback(
    async (input: {
      productId: string;
      warehouseId: string;
      quantity: number;
      operatorId?: string;
      operatorName?: string;
      operatorRole?: string;
      note?: string;
    }): Promise<void> => {
      if (inventoryApiAvailable === false) {
        throw new Error('API no disponible');
      }
      try {
        await stockApi.employeeConsumptions.create(input, '');
        markApiSynced();
        await Promise.all([hydrateProducts(), hydrateMovements(), hydrateEmployeeConsumptions()]);
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        throw new Error('API no disponible');
      }
    },
    [inventoryApiAvailable, hydrateProducts, hydrateMovements, hydrateEmployeeConsumptions, markApiSynced],
  );

  const saveStockCountSession = useCallback(
    async (session: StockCountSession): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setStockCountSessions(prev => [session, ...prev]);
        return;
      }
      try {
        await stockApi.countSessions.create(
          {
            date: session.date,
            dateType: session.dateType,
            operatorId: session.operatorId,
            operatorName: session.operatorName,
            entries: session.entries.map(e => ({
              productId: e.productId,
              productName: e.productName,
              unit: e.unit,
              expected: e.expected,
              counted: e.counted,
            })),
          },
          '',
        );
        markApiSynced();
        await hydrateCountSessions();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setStockCountSessions(prev => [session, ...prev]);
      }
    },
    [inventoryApiAvailable, hydrateCountSessions, setStockCountSessions, markApiSynced],
  );

  const refreshOperations = useCallback(async () => {
    if (!inventoryApiAvailable) return;
    await Promise.all([
      hydrateMovements(),
      hydrateEmployeeConsumptions(),
      hydrateCountSessions(),
      hydrateSuppliers(),
      hydrateOrders(),
    ]);
  }, [inventoryApiAvailable, hydrateMovements, hydrateEmployeeConsumptions, hydrateCountSessions, hydrateSuppliers, hydrateOrders]);

  const createSupplier = useCallback(
    async (input: { name: string; productIds: string[] }): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setSuppliers(prev => [...prev, { id: `sup${Date.now()}`, name: input.name, productIds: input.productIds }]);
        return;
      }
      try {
        await stockApi.suppliers.create(input, '');
        markApiSynced();
        await hydrateSuppliers();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setSuppliers(prev => [...prev, { id: `sup${Date.now()}`, name: input.name, productIds: input.productIds }]);
      }
    },
    [inventoryApiAvailable, hydrateSuppliers, setSuppliers, markApiSynced],
  );

  const updateSupplier = useCallback(
    async (input: Supplier): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setSuppliers(prev => prev.map(s => (s.id === input.id ? input : s)));
        return;
      }
      try {
        await stockApi.suppliers.update(input.id, { name: input.name, productIds: input.productIds }, '');
        markApiSynced();
        await hydrateSuppliers();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setSuppliers(prev => prev.map(s => (s.id === input.id ? input : s)));
      }
    },
    [inventoryApiAvailable, hydrateSuppliers, setSuppliers, markApiSynced],
  );

  const deleteSupplier = useCallback(
    async (id: string): Promise<void> => {
      if (inventoryApiAvailable === false) {
        setSuppliers(prev => prev.filter(s => s.id !== id));
        return;
      }
      try {
        await stockApi.suppliers.remove(id, '');
        markApiSynced();
        setSuppliers(prev => prev.filter(s => s.id !== id));
        await hydrateSuppliers();
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        setSuppliers(prev => prev.filter(s => s.id !== id));
      }
    },
    [inventoryApiAvailable, hydrateSuppliers, setSuppliers, markApiSynced],
  );

  const createPurchaseOrder = useCallback(
    async (input: {
      supplierId?: string;
      provider: string;
      items: { productId: string; quantityOrdered: number }[];
    }): Promise<Order> => {
      if (inventoryApiAvailable === false) {
        const newOrder: Order = {
          id: 'PED-' + String(orders.length + 1).padStart(3, '0'),
          date: new Date().toISOString().split('T')[0],
          provider: input.provider,
          status: 'Pendiente',
          items: input.items.map(i => ({ productId: i.productId, quantityOrdered: i.quantityOrdered })),
        };
        setOrders(prev => [...prev, newOrder]);
        return newOrder;
      }
      try {
        const created = await stockApi.purchaseOrders.create(input, '');
        markApiSynced();
        const order = mapApiPurchaseOrderToLocal(created);
        await hydrateOrders();
        return order;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        const newOrder: Order = {
          id: 'PED-' + String(orders.length + 1).padStart(3, '0'),
          date: new Date().toISOString().split('T')[0],
          provider: input.provider,
          status: 'Pendiente',
          items: input.items.map(i => ({ productId: i.productId, quantityOrdered: i.quantityOrdered })),
        };
        setOrders(prev => [...prev, newOrder]);
        return newOrder;
      }
    },
    [inventoryApiAvailable, orders.length, hydrateOrders, setOrders, markApiSynced],
  );

  const receivePurchaseOrder = useCallback(
    async (input: {
      orderId: string;
      items: {
        productId: string;
        quantityReceived: number;
        allocations: { warehouseId: string; quantity: number }[];
      }[];
      operatorId?: string;
      operatorName?: string;
    }): Promise<void> => {
      if (inventoryApiAvailable === false) {
        throw new Error('API no disponible');
      }
      try {
        await stockApi.purchaseOrders.receive(input.orderId, {
          items: input.items,
          operatorId: input.operatorId,
          operatorName: input.operatorName,
        }, '');
        markApiSynced();
        await Promise.all([hydrateOrders(), hydrateProducts(), hydrateMovements()]);
        return;
      } catch (e) {
        if (inventoryApiAvailable === true) throw e;
        throw new Error('API no disponible');
      }
    },
    [inventoryApiAvailable, hydrateOrders, hydrateProducts, hydrateMovements, markApiSynced],
  );

  const getTotalStock = useCallback((product: Product) => {
    return product.stockByWarehouse.reduce((sum, s) => sum + s.quantity, 0);
  }, []);

  const getWarehouseTotalProducts = useCallback(
    (warehouseId: string) => {
      return products.reduce((sum, p) => {
        const stock = p.stockByWarehouse.find(s => s.warehouseId === warehouseId);
        return sum + (stock?.quantity || 0);
      }, 0);
    },
    [products],
  );

  return {
    products,
    setProducts,
    warehouses,
    setWarehouses,
    orders,
    setOrders,
    auditLog,
    setAuditLog,
    categories,
    setCategories,
    consumptionLogs,
    setConsumptionLogs,
    employeeConsumptionLogs,
    setEmployeeConsumptionLogs,
    suppliers,
    setSuppliers,
    stockMovements,
    setStockMovements,
    stockCountSessions,
    setStockCountSessions,
    addStockAudit,
    addStockMovements,
    getTotalStock,
    getWarehouseTotalProducts,
    inventoryApiAvailable,
    refreshStockProducts: hydrateProducts,
    refreshOperations,
    registerEmployeeConsumption,
    saveStockCountSession,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createPurchaseOrder,
    receivePurchaseOrder,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
  };
}

export type InventoryState = ReturnType<typeof useInventoryState>;
