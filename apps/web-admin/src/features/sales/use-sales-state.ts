import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import type { AuditEntry, AuditModule } from '@/features/inventory/types';
import { salesApi } from '@/app/api/client';
import { isApiReachable } from '@/app/api/adapters';
import { mapApiSalesProductToLocal, mapApiKitchenToLocal } from './api/sales-mappers';
import { DEFAULT_SALES_CATEGORIES, LEGACY_MOCK_SALES_CATEGORIES, normalizeCategoryName } from './lib/sales-categories';
import { initialKitchens, initialSalesProducts, initialTables } from './seeds';
import type {
  Kitchen,
  SalesHistoryEntry,
  SalesPrinter,
  SalesProduct,
  SalesTable,
  SalesTicket,
  TicketTemplate,
} from './types';
import { DEFAULT_TICKET_TEMPLATE } from './types';

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

export function useSalesState() {
  const [salesCategories, setSalesCategories] = useLocalStorage<string[]>(
    storageKeys.sales.categories,
    [...DEFAULT_SALES_CATEGORIES],
  );
  const [salesCategoryEmojis, setSalesCategoryEmojis] = useLocalStorage<Record<string, string>>(
    storageKeys.sales.categoryEmojis,
    {},
  );
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

  // null = aún no chequeado, true = API es fuente de verdad, false = modo local (offline).
  const [salesApiAvailable, setSalesApiAvailable] = useState<boolean | null>(null);

  // ============ API-first: hidratación y CRUD del catálogo de ventas ============
  // Productos de venta (con receta) y cocinas viven en la API. Al montar, si la API
  // responde, sobrescribimos el caché local con lo del servidor; si no, seguimos
  // operando contra localStorage.

  const hydrateKitchens = useCallback(async () => {
    const ks = await salesApi.kitchens.list();
    setKitchens(ks.map(mapApiKitchenToLocal));
  }, [setKitchens]);

  const hydrateSalesProducts = useCallback(async () => {
    const ps = await salesApi.products.list();
    setSalesProducts(ps.map(mapApiSalesProductToLocal));
  }, [setSalesProducts]);

  useEffect(() => {
    let cancelled = false;
    isApiReachable().then(async ok => {
      if (cancelled) return;
      if (!ok) {
        setSalesApiAvailable(false);
        return;
      }
      try {
        await Promise.all([hydrateKitchens(), hydrateSalesProducts()]);
        if (!cancelled) setSalesApiAvailable(true);
      } catch {
        if (!cancelled) setSalesApiAvailable(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateKitchens, hydrateSalesProducts]);

  const createSalesProduct = useCallback(
    async (input: SalesProduct): Promise<void> => {
      if (salesApiAvailable) {
        await salesApi.products.create(
          {
            name: input.name,
            category: input.category,
            kitchenId: input.kitchenId,
            price: input.price,
            emoji: input.emoji || undefined,
            recipe: input.recipe.map(r => ({ stockProductId: r.stockProductId, quantity: r.quantity })),
          },
          '',
        );
        await hydrateSalesProducts();
        return;
      }
      setSalesProducts(prev => [...prev, { ...input, id: `p${Date.now()}` }]);
    },
    [salesApiAvailable, hydrateSalesProducts, setSalesProducts],
  );

  const updateSalesProduct = useCallback(
    async (input: SalesProduct): Promise<void> => {
      if (salesApiAvailable) {
        await salesApi.products.update(
          input.id,
          {
            name: input.name,
            category: input.category,
            kitchenId: input.kitchenId,
            price: input.price,
            emoji: input.emoji || undefined,
            active: input.active,
            recipe: input.recipe.map(r => ({ stockProductId: r.stockProductId, quantity: r.quantity })),
          },
          '',
        );
        await hydrateSalesProducts();
        return;
      }
      setSalesProducts(prev => prev.map(p => (p.id === input.id ? input : p)));
    },
    [salesApiAvailable, hydrateSalesProducts, setSalesProducts],
  );

  // La API no expone DELETE de productos de venta: se desactivan (active: false).
  const deleteSalesProduct = useCallback(
    async (id: string): Promise<void> => {
      if (salesApiAvailable) {
        await salesApi.products.update(id, { active: false }, '');
        await hydrateSalesProducts();
        return;
      }
      setSalesProducts(prev => prev.filter(p => p.id !== id));
    },
    [salesApiAvailable, hydrateSalesProducts, setSalesProducts],
  );

  const createKitchen = useCallback(
    async (input: { name: string; emoji?: string }): Promise<void> => {
      if (salesApiAvailable) {
        await salesApi.kitchens.create({ name: input.name, emoji: input.emoji || undefined }, '');
        await hydrateKitchens();
        return;
      }
      setKitchens(prev => [...prev, { id: `k-${Date.now()}`, name: input.name, emoji: input.emoji || '🍽️', active: true }]);
    },
    [salesApiAvailable, hydrateKitchens, setKitchens],
  );

  const updateKitchen = useCallback(
    async (id: string, patch: { name?: string; emoji?: string; active?: boolean }): Promise<void> => {
      if (salesApiAvailable) {
        await salesApi.kitchens.update(id, patch, '');
        await hydrateKitchens();
        return;
      }
      setKitchens(prev => prev.map(k => (k.id === id ? { ...k, ...patch } : k)));
    },
    [salesApiAvailable, hydrateKitchens, setKitchens],
  );

  const deleteKitchen = useCallback(
    async (id: string): Promise<void> => {
      if (salesApiAvailable) {
        await salesApi.kitchens.remove(id, '');
        await hydrateKitchens();
        return;
      }
      setKitchens(prev => prev.filter(k => k.id !== id));
    },
    [salesApiAvailable, hydrateKitchens, setKitchens],
  );

  const addSalesAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date' | 'module'>) => {
    appendAudit(setSalesAuditLog, 'ventas', entry);
  }, [setSalesAuditLog]);

  const addSalesCategory = useCallback((name: string, emoji = '🍽️'): string | null => {
    const normalized = normalizeCategoryName(name);
    if (!normalized) return null;
    let result: string | null = null;
    setSalesCategories(prev => {
      const existing = prev.find(c => c.toLowerCase() === normalized.toLowerCase());
      if (existing) {
        result = existing;
        return prev;
      }
      result = normalized;
      return [...prev, normalized];
    });
    if (result === normalized) {
      setSalesCategoryEmojis(prev => ({ ...prev, [normalized]: emoji }));
    }
    return result;
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
    hydrateSalesProducts,
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
  };
}

export type SalesState = ReturnType<typeof useSalesState>;
