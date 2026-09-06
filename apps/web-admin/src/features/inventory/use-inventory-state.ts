import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { migrateOrderStatuses } from './sort-orders';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { stockApi, isApiError, settingsApi } from '@/app/api/client';
import { clearApiReachabilityCache, isApiReachable } from '@/app/api/adapters';
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
import { isLocalOnlyId } from '@/shared/utils/local-ids';
import { operatorFields, optionalUuid, scheduleBackgroundHydrate, emptyToNull, emptyToNullInt } from '@/shared/utils/persist-mutation';
import {
  mergeServerWithPendingLocal,
  resolveCategoryForProduct,
  uuidProductIds,
} from './catalog-persistence';
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
  // En producción usamos API estricta (sin fallback silencioso) para evitar desincronización.
  const [inventoryApiAvailable, setInventoryApiAvailable] = useState<boolean | null>(true);
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
    const server = cats.map(mapApiCategoryToLocal);
    applyHydration(mountGen, () => setCategories(prev =>
      mergeServerWithPendingLocal(server, prev, {
        nameOf: c => c.name,
        sort: (a, b) => a.name.localeCompare(b.name, 'es'),
      }),
    ));
  }, [setCategories, applyHydration]);

  const hydrateWarehouses = useCallback(async (mountGen?: number) => {
    const whs = await stockApi.warehouses.list();
    const server = whs.map(mapApiWarehouseToLocal);
    applyHydration(mountGen, () => setWarehouses(prev =>
      mergeServerWithPendingLocal(server, prev, {
        nameOf: w => w.name,
        sort: (a, b) => a.name.localeCompare(b.name, 'es'),
      }),
    ));
  }, [setWarehouses, applyHydration]);

  const hydrateProducts = useCallback(async (mountGen?: number) => {
    const prods = await stockApi.products.list();
    const server = prods.map(mapApiProductToLocal);
    applyHydration(mountGen, () => setProducts(prev =>
      reassignProductCodes(mergeServerWithPendingLocal(server, prev)),
    ));
    return server;
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
    const server = rows.map(mapApiSupplierToLocal);
    applyHydration(mountGen, () => setSuppliers(prev =>
      mergeServerWithPendingLocal(server, prev, {
        nameOf: s => s.name,
        sort: (a, b) => a.name.localeCompare(b.name, 'es'),
      }),
    ));
  }, [setSuppliers, applyHydration]);

  const hydrateOrders = useCallback(async (mountGen?: number) => {
    const rows = await stockApi.purchaseOrders.list();
    const server = rows.map(mapApiPurchaseOrderToLocal);
    applyHydration(mountGen, () => setOrders(prev =>
      mergeServerWithPendingLocal(server, prev, { keepPendingLocal: false }),
    ));
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

  const persistCategoryId = useCallback(
    async (categoryName: string): Promise<string> => {
      const found = categories.find(
        c => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase(),
      );
      if (!found) throw new Error(`Categoría no encontrada: ${categoryName}`);
      if (!isLocalOnlyId(found.id)) return found.id;
      const created = await stockApi.categories.create(
        { name: found.name, icon: found.icon || 'Package' },
        '',
      );
      const mapped = mapApiCategoryToLocal(created);
      setCategories(prev => {
        const without = prev.filter(
          c => c.id !== mapped.id && c.name.toLowerCase() !== mapped.name.toLowerCase(),
        );
        return [...without, mapped].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      });
      return resolveCategoryForProduct([mapped], mapped.name).id;
    },
    [categories, setCategories],
  );

  const createProduct = useCallback(
    async (input: Product): Promise<void> => {
      try {
        const categoryId = await persistCategoryId(input.category);
        const code = nextProductCode(products, input.category, getCategoryCodePrefix, formatProductCode);
        const created = await stockApi.products.create(
          {
            name: input.name,
            code,
            description: emptyToNull(input.description) ?? undefined,
            categoryId,
            unit: input.unit,
            orderUnit: emptyToNullInt(input.orderUnit) ?? undefined,
            image: emptyToNull(input.image) ?? undefined,
          },
          '',
        );
        for (const s of input.stockByWarehouse) {
          if (s.quantity > 0 && !isLocalOnlyId(s.warehouseId)) {
            await stockApi.products.adjustStock(created.id, s.warehouseId, s.quantity, '');
          }
        }
        markApiSynced();
        const mapped = mapApiProductToLocal(created);
        setProducts(prev => reassignProductCodes([
          ...prev.filter(p => p.id !== mapped.id && p.id !== input.id),
          mapped,
        ]));
        scheduleBackgroundHydrate(() => hydrateProducts());
      } catch (e) {
        try { await hydrateProducts(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [persistCategoryId, products, hydrateProducts, setProducts, markApiSynced],
  );

  const updateProduct = useCallback(
    async (input: Product, previous: Product): Promise<void> => {
      try {
        const categoryId = await persistCategoryId(input.category);
        if (isLocalOnlyId(input.id)) {
          const code = nextProductCode(products, input.category, getCategoryCodePrefix, formatProductCode);
          const created = await stockApi.products.create(
            {
              name: input.name,
              code,
              description: emptyToNull(input.description) ?? undefined,
              categoryId,
              unit: input.unit,
              orderUnit: emptyToNullInt(input.orderUnit) ?? undefined,
              image: emptyToNull(input.image) ?? undefined,
            },
            '',
          );
          for (const s of input.stockByWarehouse) {
            if (s.quantity > 0 && !isLocalOnlyId(s.warehouseId)) {
              await stockApi.products.adjustStock(created.id, s.warehouseId, s.quantity, '');
            }
          }
          markApiSynced();
          setProducts(prev => reassignProductCodes([
            ...prev.filter(p => p.id !== input.id && p.id !== created.id),
            mapApiProductToLocal(created),
          ]));
          scheduleBackgroundHydrate(() => hydrateProducts());
          return;
        }
        const updated = await stockApi.products.update(
          input.id,
          {
            name: input.name,
            description: emptyToNull(input.description),
            categoryId,
            unit: input.unit,
            orderUnit: emptyToNullInt(input.orderUnit),
            image: emptyToNull(input.image),
          },
          '',
        );
        const warehouseIds = new Set([
          ...input.stockByWarehouse.map(s => s.warehouseId),
          ...previous.stockByWarehouse.map(s => s.warehouseId),
        ]);
        for (const wid of warehouseIds) {
          if (isLocalOnlyId(wid)) continue;
          const after = input.stockByWarehouse.find(s => s.warehouseId === wid)?.quantity ?? 0;
          const before = previous.stockByWarehouse.find(s => s.warehouseId === wid)?.quantity ?? 0;
          const delta = after - before;
          if (delta !== 0) await stockApi.products.adjustStock(input.id, wid, delta, '');
        }
        markApiSynced();
        setProducts(prev => reassignProductCodes(prev.map(p => (p.id === updated.id ? mapApiProductToLocal(updated) : p))));
        scheduleBackgroundHydrate(() => hydrateProducts());
      } catch (e) {
        try { await hydrateProducts(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [persistCategoryId, products, hydrateProducts, setProducts, markApiSynced],
  );

  const deleteProduct = useCallback(
    async (id: string): Promise<void> => {
      try {
        if (!isLocalOnlyId(id)) await stockApi.products.remove(id, '');
        markApiSynced();
        setProducts(prev => reassignProductCodes(prev.filter(p => p.id !== id)));
        scheduleBackgroundHydrate(() => hydrateProducts());
      } catch (e) {
        try { await hydrateProducts(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateProducts, setProducts, markApiSynced],
  );

  const createCategory = useCallback(
    async (input: { name: string; icon: string }): Promise<Category> => {
      const name = input.name.trim();
      if (!name) throw new Error('El nombre de la categoría es obligatorio');
      try {
        const created = await stockApi.categories.create(
          { name, icon: input.icon || 'Package' },
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
        scheduleBackgroundHydrate(() => hydrateCategories());
        return mapped;
      } catch (e) {
        try { await hydrateCategories(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateCategories, setCategories, markApiSynced],
  );

  const updateCategory = useCallback(
    async (input: Category): Promise<void> => {
      const payload = {
        name: input.name,
        icon: input.icon || 'Package',
      };
      try {
        const updated = await stockApi.categories.update(input.id, payload, '');
        markApiSynced();
        const mapped = mapApiCategoryToLocal(updated);
        setCategories(prev => {
          const next = prev.map(c => (c.id === mapped.id ? mapped : c));
          return next.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        });
        scheduleBackgroundHydrate(() => hydrateCategories());
      } catch (e) {
        try { await hydrateCategories(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateCategories, setCategories, markApiSynced],
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<void> => {
      try {
        if (!isLocalOnlyId(id)) await stockApi.categories.remove(id, '');
        markApiSynced();
        setCategories(prev => prev.filter(c => c.id !== id));
        scheduleBackgroundHydrate(() => hydrateCategories());
      } catch (e) {
        try { await hydrateCategories(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateCategories, setCategories, markApiSynced],
  );

  const createWarehouse = useCallback(
    async (input: Omit<Warehouse, 'id'>): Promise<void> => {
      try {
        const created = await stockApi.warehouses.create(
          { name: input.name, location: input.location, icon: input.icon || 'Warehouse' },
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
        scheduleBackgroundHydrate(() => hydrateWarehouses());
      } catch (e) {
        try { await hydrateWarehouses(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateWarehouses, setWarehouses, markApiSynced],
  );

  const updateWarehouse = useCallback(
    async (input: Warehouse): Promise<void> => {
      const payload = {
        name: input.name,
        location: input.location,
        icon: input.icon || 'Warehouse',
      };
      try {
        const updated = await stockApi.warehouses.update(input.id, payload, '');
        markApiSynced();
        const mapped = mapApiWarehouseToLocal(updated);
        setWarehouses(prev => {
          const next = prev.map(w => (w.id === mapped.id ? mapped : w));
          return next.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        });
        scheduleBackgroundHydrate(() => hydrateWarehouses());
      } catch (e) {
        try { await hydrateWarehouses(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateWarehouses, setWarehouses, markApiSynced],
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

      if (isLocalOnlyId(id)) {
        invalidateMountHydration();
        stripFromLocal();
        return;
      }

      try {
        await stockApi.warehouses.remove(id, '');
        markApiSynced();
        stripFromLocal();
        clearApiReachabilityCache();
        scheduleBackgroundHydrate(() => Promise.all([hydrateWarehouses(), hydrateProducts()]));
        setInventoryApiAvailable(true);
      } catch (e) {
        const alreadyGone = isApiError(e) && e.status === 404;
        if (alreadyGone) {
          markApiSynced();
          stripFromLocal();
          return;
        }
        try { await Promise.all([hydrateWarehouses(), hydrateProducts()]); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [
      hydrateWarehouses,
      hydrateProducts,
      setWarehouses,
      setProducts,
      markApiSynced,
      invalidateMountHydration,
    ],
  );

  const addStockAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date' | 'module'>) => {
    appendAudit(setAuditLog, 'stock', entry);
    void settingsApi.audit.create({
      module: 'stock',
      action: entry.action,
      element: entry.element,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      userName: entry.user,
    }, '').catch(() => undefined);
  }, [setAuditLog]);

  const addStockMovements = useCallback(
    (_entries: Omit<StockMovement, 'id' | 'createdAtISO'>[], _createdAtISO?: string) => {
      // Los movimientos los registra el servidor; no se fabrican en localStorage.
    },
    [],
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
      const { operatorId, operatorName, ...rest } = input;
      await stockApi.employeeConsumptions.create({
        ...rest,
        ...operatorFields({ operatorId, operatorName }),
      }, '');
      markApiSynced();
      scheduleBackgroundHydrate(() =>
        Promise.all([hydrateProducts(), hydrateMovements(), hydrateEmployeeConsumptions()]),
      );
    },
    [hydrateProducts, hydrateMovements, hydrateEmployeeConsumptions, markApiSynced],
  );

  const saveStockCountSession = useCallback(
    async (session: StockCountSession): Promise<void> => {
      await stockApi.countSessions.create(
        {
          date: session.date,
          dateType: session.dateType,
          operatorId: optionalUuid(session.operatorId),
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
      scheduleBackgroundHydrate(() => hydrateCountSessions());
    },
    [hydrateCountSessions, markApiSynced],
  );

  const refreshOperations = useCallback(async () => {
    await Promise.all([
      hydrateMovements(),
      hydrateEmployeeConsumptions(),
      hydrateCountSessions(),
      hydrateSuppliers(),
      hydrateOrders(),
    ]);
  }, [hydrateMovements, hydrateEmployeeConsumptions, hydrateCountSessions, hydrateSuppliers, hydrateOrders]);

  const createSupplier = useCallback(
    async (input: { name: string; productIds: string[] }): Promise<void> => {
      const productIds = uuidProductIds(input.productIds);
      try {
        const created = await stockApi.suppliers.create({ name: input.name, productIds }, '');
        markApiSynced();
        const mapped = mapApiSupplierToLocal(created);
        setSuppliers(prev => {
          const without = prev.filter(
            s => s.id !== mapped.id && s.name.toLowerCase() !== mapped.name.toLowerCase(),
          );
          return [...without, mapped].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        });
        scheduleBackgroundHydrate(() => hydrateSuppliers());
      } catch (e) {
        try { await hydrateSuppliers(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateSuppliers, setSuppliers, markApiSynced],
  );

  const updateSupplier = useCallback(
    async (input: Supplier): Promise<void> => {
      try {
        const updated = await stockApi.suppliers.update(input.id, { name: input.name, productIds: uuidProductIds(input.productIds) }, '');
        markApiSynced();
        const mapped = mapApiSupplierToLocal(updated);
        setSuppliers(prev => prev.map(s => (s.id === mapped.id ? mapped : s)));
        scheduleBackgroundHydrate(() => hydrateSuppliers());
      } catch (e) {
        try { await hydrateSuppliers(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateSuppliers, setSuppliers, markApiSynced],
  );

  const deleteSupplier = useCallback(
    async (id: string): Promise<void> => {
      try {
        if (!isLocalOnlyId(id)) await stockApi.suppliers.remove(id, '');
        markApiSynced();
        setSuppliers(prev => prev.filter(s => s.id !== id));
        scheduleBackgroundHydrate(() => hydrateSuppliers());
      } catch (e) {
        try { await hydrateSuppliers(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateSuppliers, setSuppliers, markApiSynced],
  );

  const createPurchaseOrder = useCallback(
    async (input: {
      supplierId?: string;
      provider: string;
      items: { productId: string; quantityOrdered: number }[];
    }): Promise<Order> => {
      const items = input.items.filter(i => !isLocalOnlyId(i.productId));
      const supplierId = input.supplierId && !isLocalOnlyId(input.supplierId) ? input.supplierId : undefined;
      if (items.length === 0) {
        throw new Error('El pedido no tiene productos sincronizados con el servidor.');
      }
      const created = await stockApi.purchaseOrders.create({
        supplierId,
        provider: input.provider,
        items,
      }, '');
      markApiSynced();
      const order = mapApiPurchaseOrderToLocal(created);
      setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
      scheduleBackgroundHydrate(() => hydrateOrders());
      return order;
    },
    [hydrateOrders, setOrders, markApiSynced],
  );

  const updatePurchaseOrder = useCallback(
    async (input: {
      orderId: string;
      supplierId?: string | null;
      provider?: string;
      items: { productId: string; quantityOrdered: number }[];
    }): Promise<Order> => {
      const items = input.items.filter(i => !isLocalOnlyId(i.productId) && i.quantityOrdered > 0);
      if (items.length === 0) throw new Error('El pedido no tiene productos sincronizados con el servidor.');
      const updated = await stockApi.purchaseOrders.update(input.orderId, {
        supplierId: input.supplierId,
        provider: input.provider,
        items,
      }, '');
      markApiSynced();
      const order = mapApiPurchaseOrderToLocal(updated);
      setOrders(prev => prev.map(o => (o.id === order.id || o.id === input.orderId ? order : o)));
      scheduleBackgroundHydrate(() => hydrateOrders());
      return order;
    },
    [hydrateOrders, setOrders, markApiSynced],
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
      const received = await stockApi.purchaseOrders.receive(input.orderId, {
        items: input.items,
        ...operatorFields({
          operatorId: input.operatorId,
          operatorName: input.operatorName,
        }),
      }, '');
      markApiSynced();
      const order = mapApiPurchaseOrderToLocal(received);
      setOrders(prev => prev.map(o => (o.id === order.id || o.id === input.orderId ? order : o)));
      scheduleBackgroundHydrate(() =>
        Promise.all([hydrateOrders(), hydrateProducts(), hydrateMovements()]),
      );
    },
    [hydrateOrders, hydrateProducts, hydrateMovements, markApiSynced],
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
    invalidateInventoryHydration: invalidateMountHydration,
    refreshStockProducts: hydrateProducts,
    refreshOperations,
    registerEmployeeConsumption,
    saveStockCountSession,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createPurchaseOrder,
    updatePurchaseOrder,
    receivePurchaseOrder,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
    updateCategory,
    deleteCategory,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
  };
}

export type InventoryState = ReturnType<typeof useInventoryState>;
