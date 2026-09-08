import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { migrateOrderStatuses } from './sort-orders';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { stockApi, isApiError, settingsApi } from '@/app/api/client';
import { clearApiReachabilityCache } from '@/app/api/adapters';
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
  // Los 8 datasets que vienen del servidor (products, warehouses, orders,
  // categories, suppliers, stockMovements, stockCountSessions,
  // employeeConsumptionLogs) YA NO se inicializan de localStorage — ver
  // Proyecto C, Task 2 (docs/superpowers/plans/2026-09-07-admin-fuente-de-
  // verdad-c.md). React Query es la fuente de verdad de lectura; localStorage
  // queda como caché de revalidación (Task 0, PersistQueryClientProvider),
  // no como estado inicial leído a mano.
  //
  // auditLog y consumptionLogs SÍ siguen en localStorage puro: no vienen de
  // ningún endpoint de lectura (auditLog se manda al servidor al crear vía
  // addStockAudit, pero nunca se hidrata de vuelta) — no son parte del
  // problema que resuelve este proyecto.
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [auditLog, setAuditLog] = useLocalStorage<AuditEntry[]>(storageKeys.inventory.auditLog, initialAuditLog);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [consumptionLogs, setConsumptionLogs] = useLocalStorage<ConsumptionLog[]>(storageKeys.inventory.consumption, []);
  const [employeeConsumptionLogs, setEmployeeConsumptionLogs] = useState<EmployeeConsumptionEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [stockCountSessions, setStockCountSessions] = useState<StockCountSession[]>([]);

  const queryClient = useQueryClient();

  // null = aún no chequeado, true = API es fuente de verdad, false = modo local (offline).
  // En producción usamos API estricta (sin fallback silencioso) para evitar desincronización.
  const [inventoryApiAvailable, setInventoryApiAvailable] = useState<boolean | null>(true);

  /**
   * Antes (localStorage-first): bumpear un "mountGen" para que una
   * hidratación inicial en vuelo no pisara cambios hechos mientras cargaba.
   * Con React Query el mismo problema — una respuesta vieja resolviendo
   * después de una más nueva — ya lo resuelve la librería (sólo la fetch más
   * reciente de cada query commitea a `data`); lo único que hace falta acá
   * es cancelar explícitamente cualquier fetch de inventario en vuelo para
   * que no siga circulando de fondo. `invalidateInventoryHydration` se
   * mantiene con el mismo nombre porque el POS (`VentasPosContext.tsx`) lo
   * llama después de cada venta/anulación — no renombrar sin actualizar ahí.
   */
  const invalidateMountHydration = useCallback(() => {
    void queryClient.cancelQueries({ queryKey: ['inventory'] });
  }, [queryClient]);

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

  // ============ API-first: hidratación (React Query) y CRUD del catálogo ============
  // El catálogo (categorías, almacenes, productos + niveles de stock) vive en la
  // API. React Query trae cada dataset por separado (en paralelo, sin
  // orquestar un Promise.all a mano); cuando cambia el resultado, se mergea
  // con lo pendiente local exactamente igual que antes (Task 2 sólo cambia
  // de dónde sale el dato, no la lógica de merge). Si la API no responde,
  // seguimos mostrando la última página conocida (cache de React Query,
  // persistida por Task 0) en vez de romper la pantalla.

  const categoriesQuery = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: () => stockApi.categories.list().then(rows => rows.map(mapApiCategoryToLocal)),
  });
  const warehousesQuery = useQuery({
    queryKey: ['inventory', 'warehouses'],
    queryFn: () => stockApi.warehouses.list().then(rows => rows.map(mapApiWarehouseToLocal)),
  });
  const productsQuery = useQuery({
    queryKey: ['inventory', 'products'],
    queryFn: () => stockApi.products.list().then(rows => rows.map(mapApiProductToLocal)),
  });
  const movementsQuery = useQuery({
    queryKey: ['inventory', 'movements'],
    queryFn: () => stockApi.movements.list({ limit: 500 }).then(rows => rows.map(mapApiMovementToLocal)),
  });
  const employeeConsumptionsQuery = useQuery({
    queryKey: ['inventory', 'employeeConsumptions'],
    queryFn: () => stockApi.employeeConsumptions.list(200).then(rows => rows.map(mapApiEmployeeConsumptionToLocal)),
  });
  const countSessionsQuery = useQuery({
    queryKey: ['inventory', 'countSessions'],
    queryFn: () => stockApi.countSessions.list(100).then(rows => rows.map(mapApiCountSessionToLocal)),
  });
  const suppliersQuery = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: () => stockApi.suppliers.list().then(rows => rows.map(mapApiSupplierToLocal)),
  });
  const ordersQuery = useQuery({
    queryKey: ['inventory', 'orders'],
    queryFn: () => stockApi.purchaseOrders.list().then(rows => rows.map(mapApiPurchaseOrderToLocal)),
  });

  // Cada `hydrateX` sigue existiendo con la misma firma que usan las 15+
  // mutaciones de más abajo (`scheduleBackgroundHydrate(() => hydrateX())`),
  // pero ahora sólo le pide a React Query que refetchee — el merge con lo
  // pendiente local pasa una sola vez, en el `useEffect` reactivo de abajo
  // que escucha `data`, no acá (evita mergear dos veces el mismo dato).
  const hydrateCategories = useCallback(
    () => queryClient.refetchQueries({ queryKey: ['inventory', 'categories'] }),
    [queryClient],
  );
  const hydrateWarehouses = useCallback(
    () => queryClient.refetchQueries({ queryKey: ['inventory', 'warehouses'] }),
    [queryClient],
  );
  const hydrateProducts = useCallback(
    () => queryClient.refetchQueries({ queryKey: ['inventory', 'products'] }),
    [queryClient],
  );
  const hydrateMovements = useCallback(
    () => queryClient.refetchQueries({ queryKey: ['inventory', 'movements'] }),
    [queryClient],
  );
  const hydrateEmployeeConsumptions = useCallback(
    () => queryClient.refetchQueries({ queryKey: ['inventory', 'employeeConsumptions'] }),
    [queryClient],
  );
  const hydrateCountSessions = useCallback(
    () => queryClient.refetchQueries({ queryKey: ['inventory', 'countSessions'] }),
    [queryClient],
  );
  const hydrateSuppliers = useCallback(
    () => queryClient.refetchQueries({ queryKey: ['inventory', 'suppliers'] }),
    [queryClient],
  );
  const hydrateOrders = useCallback(
    () => queryClient.refetchQueries({ queryKey: ['inventory', 'orders'] }),
    [queryClient],
  );

  // Cada vez que React Query trae un dataset (al montar, al invalidar tras una
  // mutación, o al reconectar), se mergea con lo pendiente local — mismo
  // merge de siempre, ahora disparado por `data` en vez de por un mount
  // effect a mano.
  useEffect(() => {
    if (categoriesQuery.data === undefined) return;
    const server = categoriesQuery.data;
    setCategories(prev => mergeServerWithPendingLocal(server, prev, {
      nameOf: c => c.name,
      sort: (a, b) => a.name.localeCompare(b.name, 'es'),
    }));
  }, [categoriesQuery.data]);

  useEffect(() => {
    if (warehousesQuery.data === undefined) return;
    const server = warehousesQuery.data;
    setWarehouses(prev => mergeServerWithPendingLocal(server, prev, {
      nameOf: w => w.name,
      sort: (a, b) => a.name.localeCompare(b.name, 'es'),
    }));
  }, [warehousesQuery.data]);

  useEffect(() => {
    if (productsQuery.data === undefined) return;
    const server = productsQuery.data;
    setProducts(prev => reassignProductCodes(mergeServerWithPendingLocal(server, prev)));
  }, [productsQuery.data]);

  useEffect(() => {
    if (movementsQuery.data === undefined) return;
    setStockMovements(movementsQuery.data);
  }, [movementsQuery.data]);

  useEffect(() => {
    if (employeeConsumptionsQuery.data === undefined) return;
    setEmployeeConsumptionLogs(employeeConsumptionsQuery.data);
  }, [employeeConsumptionsQuery.data]);

  useEffect(() => {
    if (countSessionsQuery.data === undefined) return;
    setStockCountSessions(countSessionsQuery.data);
  }, [countSessionsQuery.data]);

  useEffect(() => {
    if (suppliersQuery.data === undefined) return;
    const server = suppliersQuery.data;
    setSuppliers(prev => mergeServerWithPendingLocal(server, prev, {
      nameOf: s => s.name,
      sort: (a, b) => a.name.localeCompare(b.name, 'es'),
    }));
  }, [suppliersQuery.data]);

  useEffect(() => {
    if (ordersQuery.data === undefined) return;
    const server = ordersQuery.data;
    setOrders(prev => mergeServerWithPendingLocal(server, prev, { keepPendingLocal: false }));
  }, [ordersQuery.data]);

  const hydrationQueries = [
    categoriesQuery, warehousesQuery, productsQuery, movementsQuery,
    employeeConsumptionsQuery, countSessionsQuery, suppliersQuery, ordersQuery,
  ];

  useEffect(() => {
    if (hydrationQueries.some(q => q.isError)) {
      setInventoryApiAvailable(false);
      return;
    }
    if (hydrationQueries.every(q => q.isSuccess)) {
      setInventoryApiAvailable(true);
    }
    // hydrationQueries se reconstruye en cada render — sólo nos importan sus
    // banderas de estado, no la identidad del array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categoriesQuery.isError, warehousesQuery.isError, productsQuery.isError, movementsQuery.isError,
    employeeConsumptionsQuery.isError, countSessionsQuery.isError, suppliersQuery.isError, ordersQuery.isError,
    categoriesQuery.isSuccess, warehousesQuery.isSuccess, productsQuery.isSuccess, movementsQuery.isSuccess,
    employeeConsumptionsQuery.isSuccess, countSessionsQuery.isSuccess, suppliersQuery.isSuccess, ordersQuery.isSuccess,
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
            version: previous.version,
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
      version?: number;
    }): Promise<Order> => {
      const items = input.items.filter(i => !isLocalOnlyId(i.productId) && i.quantityOrdered > 0);
      if (items.length === 0) throw new Error('El pedido no tiene productos sincronizados con el servidor.');
      const updated = await stockApi.purchaseOrders.update(input.orderId, {
        supplierId: input.supplierId,
        provider: input.provider,
        items,
        version: input.version,
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
