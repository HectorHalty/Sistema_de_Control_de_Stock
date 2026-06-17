import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import type { AuditEntry, AuditModule } from '@/features/inventory/types';
import { salesApi } from '@/app/api/client';
import { isApiReachable } from '@/app/api/adapters';
import { mapApiSalesProductToLocal, mapApiKitchenToLocal, mapApiTicketToLocal, normalizeSalesProduct } from './api/sales-mappers';
import { DEFAULT_SALES_CATEGORIES, LEGACY_MOCK_SALES_CATEGORIES, normalizeCategoryName } from './lib/sales-categories';
import { initialKitchens, initialSalesProducts, initialTables } from './seeds';
import type {
  Kitchen,
  SalesHistoryEntry,
  SalesPrinter,
  SalesProduct,
  SalesTable,
  SalesTicket,
  TeamAccount,
  TicketTemplate,
} from './types';
import { DEFAULT_TICKET_TEMPLATE } from './types';
import { historyFromTickets, mergeSalesHistory, mergeTicketsFromServer } from './sales-history';
import { isLocalOnlyId } from '@/shared/utils/local-ids';

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

function upsertSalesProduct(
  setter: Dispatch<SetStateAction<SalesProduct[]>>,
  product: SalesProduct,
) {
  const normalized = normalizeSalesProduct(product);
  setter(prev => {
    const idx = prev.findIndex(p => p.id === normalized.id);
    if (idx < 0) return [...prev, normalized];
    return prev.map(p => (p.id === normalized.id ? normalized : p));
  });
}

function toApiSalesProductBody(input: SalesProduct) {
  const kind = input.kind === 'promo' ? 'promo' : 'simple';
  if (kind === 'promo') {
    return {
      name: input.name,
      category: input.category,
      kitchenId: input.kitchenId,
      price: input.price,
      emoji: input.emoji || undefined,
      kind: 'promo' as const,
      bundle: (input.bundle ?? []).map(b => ({
        componentProductId: b.salesProductId,
        quantity: b.quantity,
      })),
    };
  }
  return {
    name: input.name,
    category: input.category,
    kitchenId: input.kitchenId,
    price: input.price,
    emoji: input.emoji || undefined,
    kind: 'simple' as const,
    recipe: (input.recipe ?? []).map(r => ({ stockProductId: r.stockProductId, quantity: r.quantity })),
  };
}

export function useSalesState() {
  const [salesCategories, setSalesCategories] = useLocalStorage<string[]>(
    storageKeys.sales.categories,
    [...DEFAULT_SALES_CATEGORIES],
  );
  const [salesCategoryEmojis, setSalesCategoryEmojis] = useLocalStorage<Record<string, string>>(
    storageKeys.sales.categoryEmojis,
    {},
  );
  const salesCategoriesRef = useRef(salesCategories);
  salesCategoriesRef.current = salesCategories;
  const [kitchens, setKitchens] = useLocalStorage<Kitchen[]>(storageKeys.sales.kitchens, initialKitchens);
  const [salesProducts, setSalesProducts] = useLocalStorage<SalesProduct[]>(storageKeys.sales.products, initialSalesProducts);
  const [salesTickets, setSalesTickets] = useLocalStorage<SalesTicket[]>(storageKeys.sales.tickets, []);
  const [salesTicketCounter, setSalesTicketCounter] = useLocalStorage<number>(storageKeys.sales.ticketCounter, 1000);
  const [salesTables, setSalesTables] = useLocalStorage<SalesTable[]>(storageKeys.sales.tables, initialTables);
  const [salesHistory, setSalesHistory] = useLocalStorage<SalesHistoryEntry[]>(storageKeys.sales.history, []);
  const [salesAuditLog, setSalesAuditLog] = useLocalStorage<AuditEntry[]>(storageKeys.sales.auditLog, []);
  const [salesPrinters, setSalesPrinters] = useLocalStorage<SalesPrinter[]>(storageKeys.sales.printers, []);
  const [ticketTemplate, setTicketTemplate] = useLocalStorage<TicketTemplate>(
    storageKeys.sales.ticketTemplate,
    DEFAULT_TICKET_TEMPLATE,
  );
  const [validateStockOnSale, setValidateStockOnSale] = useLocalStorage<boolean>(
    storageKeys.sales.validateStockOnSale,
    true,
  );
  const [raceConditionProtection, setRaceConditionProtection] = useLocalStorage<boolean>(
    storageKeys.sales.raceConditionProtection,
    true,
  );
  const [teamAccounts, setTeamAccounts] = useLocalStorage<TeamAccount[]>(
    storageKeys.sales.teamAccounts,
    [],
  );

  // Quitar categorías mock precargadas en sesiones anteriores.
  useEffect(() => {
    const mockSet = new Set<string>(LEGACY_MOCK_SALES_CATEGORIES);
    setSalesCategories(prev => {
      const next = prev.filter(c => !mockSet.has(c));
      return next.length === prev.length ? prev : next;
    });
    setSalesCategoryEmojis(prev => {
      let changed = false;
      const next = { ...prev };
      for (const name of LEGACY_MOCK_SALES_CATEGORIES) {
        if (name in next) {
          delete next[name];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [setSalesCategories, setSalesCategoryEmojis]);

  useEffect(() => {
    setSalesProducts(prev => {
      if (prev.every(p => p.kind && p.recipe && p.bundle)) return prev;
      return prev.map(normalizeSalesProduct);
    });
  }, [setSalesProducts]);

  // null = aún no chequeado, true = API es fuente de verdad, false = modo local (offline).
  const [salesApiAvailable, setSalesApiAvailable] = useState<boolean | null>(null);
  const mountHydrationGen = useRef(0);

  const invalidateMountHydration = useCallback(() => {
    mountHydrationGen.current += 1;
  }, []);

  const applyHydration = useCallback((mountGen: number | undefined, apply: () => void) => {
    if (mountGen === undefined || mountGen === mountHydrationGen.current) apply();
  }, []);

  const markApiSynced = useCallback(() => {
    invalidateMountHydration();
    setSalesApiAvailable(prev => (prev === false ? false : true));
  }, [invalidateMountHydration]);

  // ============ API-first: hidratación y CRUD del catálogo de ventas ============
  // Productos de venta (con receta) y cocinas viven en la API. Al montar, si la API
  // responde, sobrescribimos el caché local con lo del servidor; si no, seguimos
  // operando contra localStorage.

  const hydrateKitchens = useCallback(async (mountGen?: number) => {
    const ks = await salesApi.kitchens.list();
    applyHydration(mountGen, () => setKitchens(ks.map(mapApiKitchenToLocal)));
  }, [setKitchens, applyHydration]);

  const hydrateSalesProducts = useCallback(async (mountGen?: number): Promise<SalesProduct[]> => {
    const ps = await salesApi.products.list();
    const server = ps.map(mapApiSalesProductToLocal);
    applyHydration(mountGen, () => setSalesProducts(prev => {
      const serverIds = new Set(server.map(p => p.id));
      const pendingLocal = prev
        .filter(p => isLocalOnlyId(p.id) && !serverIds.has(p.id))
        .map(normalizeSalesProduct);
      return [...server, ...pendingLocal];
    }));
    return server;
  }, [setSalesProducts, applyHydration]);

  const hydrateTickets = useCallback(
    async (products: SalesProduct[], mountGen?: number) => {
      const ts = await salesApi.tickets.list();
      const local = ts.map(t => mapApiTicketToLocal(t, products));
      applyHydration(mountGen, () => {
        setSalesTickets(prev => mergeTicketsFromServer(local, prev));
        setSalesHistory(prev => mergeSalesHistory(historyFromTickets(local), prev));
        const maxNum = local.reduce((m, t) => Math.max(m, t.number), 0);
        if (maxNum > 0) setSalesTicketCounter(c => Math.max(c, maxNum));
      });
    },
    [setSalesTickets, setSalesHistory, setSalesTicketCounter, applyHydration],
  );

  useEffect(() => {
    let cancelled = false;
    const mountGen = mountHydrationGen.current;
    isApiReachable().then(async ok => {
      if (cancelled) return;
      if (!ok) {
        setSalesApiAvailable(false);
        return;
      }
      try {
        const [, products] = await Promise.all([hydrateKitchens(mountGen), hydrateSalesProducts(mountGen)]);
        await hydrateTickets(products, mountGen);
        if (!cancelled && mountGen === mountHydrationGen.current) {
          setSalesApiAvailable(true);
        }
      } catch {
        if (!cancelled && mountGen === mountHydrationGen.current) {
          setSalesApiAvailable(false);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateKitchens, hydrateSalesProducts, hydrateTickets]);

  const createSalesProduct = useCallback(
    async (input: SalesProduct): Promise<void> => {
      const product: SalesProduct = {
        kind: 'simple',
        bundle: [],
        recipe: [],
        ...input,
        id: input.id || `p${Date.now()}`,
      };
      upsertSalesProduct(setSalesProducts, product);

      if (salesApiAvailable !== true) return;

      try {
        await salesApi.products.create(toApiSalesProductBody(product), '');
        markApiSynced();
        await hydrateSalesProducts();
      } catch (e) {
        throw e;
      }
    },
    [salesApiAvailable, hydrateSalesProducts, setSalesProducts, markApiSynced],
  );

  const updateSalesProduct = useCallback(
    async (input: SalesProduct): Promise<void> => {
      upsertSalesProduct(setSalesProducts, input);

      if (salesApiAvailable !== true) return;

      try {
        const body = { ...toApiSalesProductBody(input), active: input.active };
        if (isLocalOnlyId(input.id)) {
          await salesApi.products.create(toApiSalesProductBody(input), '');
        } else {
          await salesApi.products.update(input.id, body, '');
        }
        markApiSynced();
        await hydrateSalesProducts();
      } catch (e) {
        throw e;
      }
    },
    [salesApiAvailable, hydrateSalesProducts, setSalesProducts, markApiSynced],
  );

  const deleteSalesProduct = useCallback(
    async (id: string): Promise<void> => {
      setSalesProducts(prev => prev.filter(p => p.id !== id));

      if (salesApiAvailable !== true) return;

      try {
        if (!isLocalOnlyId(id)) {
          await salesApi.products.update(id, { active: false }, '');
        }
        markApiSynced();
        await hydrateSalesProducts();
      } catch (e) {
        throw e;
      }
    },
    [salesApiAvailable, hydrateSalesProducts, setSalesProducts, markApiSynced],
  );

  const createKitchen = useCallback(
    async (input: { name: string; emoji?: string }): Promise<void> => {
      if (salesApiAvailable === false) {
        setKitchens(prev => [...prev, { id: `k-${Date.now()}`, name: input.name, emoji: input.emoji || '🍽️', active: true }]);
        return;
      }
      try {
        await salesApi.kitchens.create({ name: input.name, emoji: input.emoji || undefined }, '');
        markApiSynced();
        await hydrateKitchens();
        return;
      } catch (e) {
        if (salesApiAvailable === true) throw e;
        setKitchens(prev => [...prev, { id: `k-${Date.now()}`, name: input.name, emoji: input.emoji || '🍽️', active: true }]);
      }
    },
    [salesApiAvailable, hydrateKitchens, setKitchens, markApiSynced],
  );

  const updateKitchen = useCallback(
    async (id: string, patch: { name?: string; emoji?: string; active?: boolean }): Promise<void> => {
      if (salesApiAvailable === false) {
        setKitchens(prev => prev.map(k => (k.id === id ? { ...k, ...patch } : k)));
        return;
      }
      try {
        await salesApi.kitchens.update(id, patch, '');
        markApiSynced();
        await hydrateKitchens();
        return;
      } catch (e) {
        if (salesApiAvailable === true) throw e;
        setKitchens(prev => prev.map(k => (k.id === id ? { ...k, ...patch } : k)));
      }
    },
    [salesApiAvailable, hydrateKitchens, setKitchens, markApiSynced],
  );

  const deleteKitchen = useCallback(
    async (id: string): Promise<void> => {
      if (salesApiAvailable === false) {
        setKitchens(prev => prev.filter(k => k.id !== id));
        return;
      }
      try {
        await salesApi.kitchens.remove(id, '');
        markApiSynced();
        await hydrateKitchens();
        return;
      } catch (e) {
        if (salesApiAvailable === true) throw e;
        setKitchens(prev => prev.filter(k => k.id !== id));
      }
    },
    [salesApiAvailable, hydrateKitchens, setKitchens, markApiSynced],
  );

  const addSalesAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date' | 'module'>) => {
    appendAudit(setSalesAuditLog, 'ventas', entry);
  }, [setSalesAuditLog]);

  const addSalesCategory = useCallback((name: string, emoji = '🍽️'): string | null => {
    const normalized = normalizeCategoryName(name);
    if (!normalized) return null;

    const prev = salesCategoriesRef.current;
    const existing = prev.find(c => c.toLowerCase() === normalized.toLowerCase());
    const key = existing ?? normalized;

    if (!existing) {
      setSalesCategories(current => [...current, normalized]);
    }
    setSalesCategoryEmojis(current => ({ ...current, [key]: emoji }));

    return key;
  }, [setSalesCategories, setSalesCategoryEmojis]);

  const addPrinter = useCallback((printer: Omit<SalesPrinter, 'id'>) => {
    setSalesPrinters(prev => {
      const id = `pr${Date.now()}`;
      const makeDefault = printer.isDefault || prev.length === 0;
      const normalized = { ...printer, id, isDefault: makeDefault };
      if (makeDefault) {
        return [...prev.map(p => ({ ...p, isDefault: false })), normalized];
      }
      return [...prev, normalized];
    });
  }, [setSalesPrinters]);

  const updatePrinter = useCallback((id: string, patch: Partial<SalesPrinter>) => {
    setSalesPrinters(prev =>
      prev.map(p => (p.id === id ? { ...p, ...patch } : p)),
    );
  }, [setSalesPrinters]);

  const removePrinter = useCallback((id: string) => {
    setSalesPrinters(prev => {
      const next = prev.filter(p => p.id !== id);
      if (next.length > 0 && !next.some(p => p.isDefault)) {
        return next.map((p, i) => (i === 0 ? { ...p, isDefault: true } : p));
      }
      return next;
    });
  }, [setSalesPrinters]);

  const setDefaultPrinter = useCallback((id: string) => {
    setSalesPrinters(prev => prev.map(p => ({ ...p, isDefault: p.id === id })));
  }, [setSalesPrinters]);

  const togglePrinter = useCallback((id: string) => {
    setSalesPrinters(prev =>
      prev.map(p => (p.id === id ? { ...p, connected: !p.connected } : p)),
    );
  }, [setSalesPrinters]);

  const updateTicketTemplate = useCallback((patch: Partial<TicketTemplate>) => {
    setTicketTemplate(prev => ({ ...prev, ...patch }));
  }, [setTicketTemplate]);

  return {
    salesCategories,
    setSalesCategories,
    salesCategoryEmojis,
    setSalesCategoryEmojis,
    addSalesCategory,
    kitchens,
    setKitchens,
    createKitchen,
    updateKitchen,
    deleteKitchen,
    salesProducts,
    setSalesProducts,
    salesApiAvailable,
    invalidateSalesHydration: invalidateMountHydration,
    hydrateSalesProducts,
    hydrateTickets,
    createSalesProduct,
    updateSalesProduct,
    deleteSalesProduct,
    salesTickets,
    setSalesTickets,
    salesTicketCounter,
    setSalesTicketCounter,
    salesTables,
    setSalesTables,
    salesHistory,
    setSalesHistory,
    salesAuditLog,
    setSalesAuditLog,
    addSalesAudit,
    salesPrinters,
    setSalesPrinters,
    addPrinter,
    updatePrinter,
    removePrinter,
    setDefaultPrinter,
    togglePrinter,
    ticketTemplate,
    setTicketTemplate,
    updateTicketTemplate,
    validateStockOnSale,
    setValidateStockOnSale,
    raceConditionProtection,
    setRaceConditionProtection,
    teamAccounts,
    setTeamAccounts,
  };
}

export type SalesState = ReturnType<typeof useSalesState>;
