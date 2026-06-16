import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { migrateOrderStatuses } from './sort-orders';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { stockApi } from '@/app/api/client';
import { isApiReachable } from '@/app/api/adapters';
import {
  mapApiProductToLocal,
  mapApiWarehouseToLocal,
  mapApiCategoryToLocal,
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

  const hydrateCategories = useCallback(async () => {
    const cats = await stockApi.categories.list();
    setCategories(cats.map(mapApiCategoryToLocal));
  }, [setCategories]);

  const hydrateWarehouses = useCallback(async () => {
    const whs = await stockApi.warehouses.list();
    setWarehouses(whs.map(mapApiWarehouseToLocal));
  }, [setWarehouses]);

  const hydrateProducts = useCallback(async () => {
    const prods = await stockApi.products.list();
    setProducts(prods.map(mapApiProductToLocal));
  }, [setProducts]);

  useEffect(() => {
    let cancelled = false;
    isApiReachable().then(async ok => {
      if (cancelled) return;
      if (!ok) {
        setInventoryApiAvailable(false);
        return;
      }
      try {
        await Promise.all([hydrateCategories(), hydrateWarehouses(), hydrateProducts()]);
        if (!cancelled) setInventoryApiAvailable(true);
      } catch {
        if (!cancelled) setInventoryApiAvailable(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateCategories, hydrateWarehouses, hydrateProducts]);

  const createProduct = useCallback(
    async (input: Product): Promise<void> => {
      if (inventoryApiAvailable) {
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
        await hydrateProducts();
        return;
      }
      setProducts(prev => reassignProductCodes([...prev, { ...input, id: `p${Date.now()}`, code: '' }]));
    },
    [inventoryApiAvailable, categories, products, hydrateProducts, setProducts],
  );

  const updateProduct = useCallback(
    async (input: Product, previous: Product): Promise<void> => {
      if (inventoryApiAvailable) {
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
        await hydrateProducts();
        return;
      }
      setProducts(prev => reassignProductCodes(prev.map(p => (p.id === input.id ? input : p))));
    },
    [inventoryApiAvailable, categories, hydrateProducts, setProducts],
  );

  const deleteProduct = useCallback(
    async (id: string): Promise<void> => {
      if (inventoryApiAvailable) {
        await stockApi.products.remove(id, '');
        await hydrateProducts();
        return;
      }
      setProducts(prev => reassignProductCodes(prev.filter(p => p.id !== id)));
    },
    [inventoryApiAvailable, hydrateProducts, setProducts],
  );

  const createCategory = useCallback(
    async (input: { name: string; icon: string }): Promise<void> => {
      if (inventoryApiAvailable) {
        await stockApi.categories.create({ name: input.name, icon: input.icon }, '');
        await hydrateCategories();
        return;
      }
      setCategories(prev => [...prev, { ...input, id: `cat${Date.now()}` }]);
    },
    [inventoryApiAvailable, hydrateCategories, setCategories],
  );

  const createWarehouse = useCallback(
    async (input: Omit<Warehouse, 'id'>): Promise<void> => {
      if (inventoryApiAvailable) {
        await stockApi.warehouses.create(
          { name: input.name, location: input.location, icon: input.icon },
          '',
        );
        await hydrateWarehouses();
        return;
      }
      setWarehouses(prev => [...prev, { ...input, id: `w${Date.now()}` }]);
    },
    [inventoryApiAvailable, hydrateWarehouses, setWarehouses],
  );

  const updateWarehouse = useCallback(
    async (input: Warehouse): Promise<void> => {
      if (inventoryApiAvailable) {
        await stockApi.warehouses.update(
          input.id,
          { name: input.name, location: input.location, icon: input.icon },
          '',
        );
        await hydrateWarehouses();
        return;
      }
      setWarehouses(prev => prev.map(w => (w.id === input.id ? input : w)));
    },
    [inventoryApiAvailable, hydrateWarehouses, setWarehouses],
  );

  const deleteWarehouse = useCallback(
    async (id: string): Promise<void> => {
      if (inventoryApiAvailable) {
        await stockApi.warehouses.remove(id, '');
        await Promise.all([hydrateWarehouses(), hydrateProducts()]);
        return;
      }
      setWarehouses(prev => prev.filter(w => w.id !== id));
    },
    [inventoryApiAvailable, hydrateWarehouses, hydrateProducts, setWarehouses],
  );

  const addStockAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date' | 'module'>) => {
    appendAudit(setAuditLog, 'stock', entry);
  }, [setAuditLog]);

  const addStockMovements = useCallback(
    (entries: Omit<StockMovement, 'id' | 'createdAtISO'>[], createdAtISO?: string) => {
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
    [setStockMovements],
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
