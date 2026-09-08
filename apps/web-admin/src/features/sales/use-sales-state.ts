import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import type { AuditEntry, AuditModule } from '@/features/inventory/types';
import { salesApi, settingsApi } from '@/app/api/client';
import { isApiReachable } from '@/app/api/adapters';
import { invalidatePrinterTestCache } from '@/features/sales/lib/printer-test-cache';
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
import { scheduleBackgroundHydrate, reportMutationError } from '@/shared/utils/persist-mutation';
import { persistRemoteConfig } from '@/shared/utils/remote-config';

const DEFAULT_SALES_EMOJI = '🍽️';

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
      categoriaVentaId: input.categoriaVentaId,
      kitchenId: input.kitchenId,
      price: input.price,
      emoji: input.emoji || DEFAULT_SALES_EMOJI,
      kind: 'promo' as const,
      bundle: (input.bundle ?? []).map(b => ({
        componentProductId: b.salesProductId,
        quantity: b.quantity,
      })),
    };
  }
  return {
    name: input.name,
    categoriaVentaId: input.categoriaVentaId,
    kitchenId: input.kitchenId,
    price: input.price,
    emoji: input.emoji || DEFAULT_SALES_EMOJI,
    kind: 'simple' as const,
    recipe: (input.recipe ?? [])
      .filter(r => r.stockProductId && !isLocalOnlyId(r.stockProductId))
      .map(r => ({ stockProductId: r.stockProductId, quantity: r.quantity })),
  };
}

/**
 * Resuelve el id real de una categoría de venta a partir de su nombre
 * (la UI todavía elige categorías por nombre vía SalesCategorySelect).
 * Si la lista remota no está disponible, cae al id ya conocido del producto.
 */
async function resolveCategoriaVentaId(categoryName: string, fallbackId?: string): Promise<string> {
  try {
    const rows = await settingsApi.salesCategories.list();
    const found = rows.find(r => r.name.toLowerCase() === categoryName.trim().toLowerCase());
    if (found) return found.id;
  } catch {
    // sin conexión: seguimos con el id ya conocido (si lo hay)
  }
  return fallbackId ?? '';
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
  // En producción usamos API estricta para evitar cambios solo locales.
  const [salesApiAvailable, setSalesApiAvailable] = useState<boolean | null>(true);
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

  useEffect(() => {
    void settingsApi.salesCategories.list().then(rows => {
      if (!rows.length) return;
      setSalesCategories(rows.map(r => r.name));
      const emojis: Record<string, string> = {};
      for (const row of rows) emojis[row.name] = row.emoji;
      setSalesCategoryEmojis(emojis);
    }).catch(() => undefined);
    void settingsApi.printers.list().then(rows => {
      setSalesPrinters(rows.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type as SalesPrinter['type'],
        ip: p.ip,
        port: p.port,
        paperWidth: (p.paperWidth === 58 ? 58 : 80) as 58 | 80,
        connected: p.connected,
        isDefault: p.isDefault,
      })));
    }).catch(() => undefined);
    void settingsApi.tables.list().then(rows => {
      if (!rows.length) return;
      setSalesTables(rows.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status === 'ocupada' ? 'ocupada' : 'libre',
        currentOrderId: t.currentOrderId ?? undefined,
      })));
    }).catch(() => undefined);
    void settingsApi.config.list('sales').then(rows => {
      for (const row of rows) {
        if (row.key === 'sales.validateStockOnSale' && typeof row.value === 'boolean') setValidateStockOnSale(row.value);
        if (row.key === 'sales.raceConditionProtection' && typeof row.value === 'boolean') setRaceConditionProtection(row.value);
        if (row.key === 'sales.ticketTemplate' && row.value && typeof row.value === 'object') {
          setTicketTemplate(prev => ({ ...prev, ...(row.value as TicketTemplate) }));
        }
      }
    }).catch(() => undefined);
    void settingsApi.teamAccounts.list().then(rows => {
      setTeamAccounts(rows.map(r => ({
        id: r.id,
        team: r.team,
        openedAt: new Date(r.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        status: r.status === 'cerrada' ? 'cerrada' : 'abierta',
        items: Array.isArray(r.items) ? r.items as TeamAccount['items'] : [],
      })));
    }).catch(() => undefined);
  }, [setSalesCategories, setSalesCategoryEmojis, setSalesPrinters, setSalesTables, setValidateStockOnSale, setRaceConditionProtection, setTicketTemplate, setTeamAccounts]);

  const createSalesProduct = useCallback(
    async (input: SalesProduct): Promise<void> => {
      const categoriaVentaId = await resolveCategoriaVentaId(input.category, input.categoriaVentaId);
      const product: SalesProduct = {
        kind: 'simple',
        bundle: [],
        recipe: [],
        ...input,
        categoriaVentaId,
        id: input.id || `p${Date.now()}`,
      };
      try {
        const created = await salesApi.products.create(toApiSalesProductBody(product), '');
        markApiSynced();
        upsertSalesProduct(setSalesProducts, mapApiSalesProductToLocal(created));
        scheduleBackgroundHydrate(() => hydrateSalesProducts());
      } catch (e) {
        try { await hydrateSalesProducts(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateSalesProducts, setSalesProducts, markApiSynced],
  );

  const updateSalesProduct = useCallback(
    async (input: SalesProduct): Promise<void> => {
      try {
        const categoriaVentaId = await resolveCategoriaVentaId(input.category, input.categoriaVentaId);
        const resolved: SalesProduct = { ...input, categoriaVentaId };
        const body = { ...toApiSalesProductBody(resolved), active: resolved.active, version: resolved.version };
        if (isLocalOnlyId(resolved.id)) {
          const created = await salesApi.products.create(toApiSalesProductBody(resolved), '');
          upsertSalesProduct(setSalesProducts, mapApiSalesProductToLocal(created));
        } else {
          const updated = await salesApi.products.update(resolved.id, body, '');
          upsertSalesProduct(setSalesProducts, mapApiSalesProductToLocal(updated));
        }
        markApiSynced();
        scheduleBackgroundHydrate(() => hydrateSalesProducts());
      } catch (e) {
        try { await hydrateSalesProducts(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateSalesProducts, setSalesProducts, markApiSynced],
  );

  const deleteSalesProduct = useCallback(
    async (id: string): Promise<void> => {
      try {
        if (!isLocalOnlyId(id)) {
          await salesApi.products.update(id, { active: false }, '');
        }
        markApiSynced();
        setSalesProducts(prev => prev.filter(p => p.id !== id));
        scheduleBackgroundHydrate(() => hydrateSalesProducts());
      } catch (e) {
        try { await hydrateSalesProducts(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateSalesProducts, setSalesProducts, markApiSynced],
  );

  const createKitchen = useCallback(
    async (input: { name: string; emoji?: string }): Promise<void> => {
      try {
        const created = await salesApi.kitchens.create({ name: input.name, emoji: input.emoji || DEFAULT_SALES_EMOJI }, '');
        markApiSynced();
        const mapped = mapApiKitchenToLocal(created);
        setKitchens(prev => {
          const without = prev.filter(k => k.id !== mapped.id && k.name.toLowerCase() !== mapped.name.toLowerCase());
          return [...without, mapped].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        });
        scheduleBackgroundHydrate(() => hydrateKitchens());
      } catch (e) {
        try { await hydrateKitchens(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateKitchens, setKitchens, markApiSynced],
  );

  const updateKitchen = useCallback(
    async (id: string, patch: { name?: string; emoji?: string; active?: boolean }): Promise<void> => {
      try {
        const updated = await salesApi.kitchens.update(
          id,
          {
            ...patch,
            ...(patch.emoji !== undefined ? { emoji: patch.emoji || DEFAULT_SALES_EMOJI } : {}),
          },
          '',
        );
        markApiSynced();
        const mapped = mapApiKitchenToLocal(updated);
        setKitchens(prev => prev.map(k => (k.id === mapped.id ? mapped : k)));
        scheduleBackgroundHydrate(() => hydrateKitchens());
      } catch (e) {
        try { await hydrateKitchens(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateKitchens, setKitchens, markApiSynced],
  );

  const deleteKitchen = useCallback(
    async (id: string): Promise<void> => {
      try {
        if (!isLocalOnlyId(id)) await salesApi.kitchens.remove(id, '');
        markApiSynced();
        setKitchens(prev => prev.filter(k => k.id !== id));
        scheduleBackgroundHydrate(() => hydrateKitchens());
      } catch (e) {
        try { await hydrateKitchens(); } catch { /* rethrow original */ }
        throw e;
      }
    },
    [hydrateKitchens, setKitchens, markApiSynced],
  );

  const addSalesAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date' | 'module'>) => {
    appendAudit(setSalesAuditLog, 'ventas', entry);
    void settingsApi.audit.create({
      module: 'ventas',
      action: entry.action,
      element: entry.element,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      userName: entry.user,
    }, '').catch(() => undefined);
  }, [setSalesAuditLog]);

  const addSalesCategory = useCallback((name: string, emoji = '🍽️'): string | null => {
    const normalized = normalizeCategoryName(name);
    if (!normalized) return null;

    const prev = salesCategoriesRef.current;
    const existing = prev.find(c => c.toLowerCase() === normalized.toLowerCase());
    const key = existing ?? normalized;

    if (!existing) {
      setSalesCategories(current => [...current, normalized]);
      void settingsApi.salesCategories.create({ name: normalized, emoji: emoji || DEFAULT_SALES_EMOJI }, '')
        .catch(error => reportMutationError(error, 'No se pudo guardar la categoría de venta'));
    }
    setSalesCategoryEmojis(current => ({ ...current, [key]: emoji || DEFAULT_SALES_EMOJI }));
    if (existing) {
      void settingsApi.salesCategories.list().then(rows => {
        const row = rows.find(r => r.name.toLowerCase() === key.toLowerCase());
        if (row) void settingsApi.salesCategories.update(row.id, { emoji: emoji || DEFAULT_SALES_EMOJI }, '');
      }).catch(() => undefined);
    }

    return key;
  }, [setSalesCategories, setSalesCategoryEmojis]);

  const addPrinter = useCallback((printer: Omit<SalesPrinter, 'id'>) => {
    const tempId = `pr${Date.now()}`;
    setSalesPrinters(prev => {
      const makeDefault = printer.isDefault || prev.length === 0;
      const normalized = { ...printer, id: tempId, isDefault: makeDefault };
      const next = makeDefault
        ? [...prev.map(p => ({ ...p, isDefault: false })), normalized]
        : [...prev, normalized];
      void settingsApi.printers.create({ ...printer, isDefault: makeDefault }, '')
        .then(row => {
          setSalesPrinters(current => current.map(p => (
            p.id === tempId
              ? {
                  ...p,
                  id: String(row.id),
                  name: String(row.name ?? p.name),
                  type: (row.type as SalesPrinter['type']) ?? p.type,
                  ip: String(row.ip ?? p.ip),
                  port: Number(row.port ?? p.port),
                  paperWidth: Number(row.paperWidth) === 58 ? 58 : 80,
                  connected: Boolean(row.connected),
                  isDefault: Boolean(row.isDefault),
                }
              : p
          )));
        })
        .catch(error => {
          reportMutationError(error, 'No se pudo guardar la impresora');
          setSalesPrinters(current => current.filter(p => p.id !== tempId));
        });
      return next;
    });
  }, [setSalesPrinters]);

  const updatePrinter = useCallback((id: string, patch: Partial<SalesPrinter>) => {
    setSalesPrinters(prev => {
      const current = prev.find(p => p.id === id);
      if (current && (patch.ip != null || patch.port != null)) {
        invalidatePrinterTestCache(current.ip, current.port);
        if (patch.ip != null || patch.port != null) {
          invalidatePrinterTestCache(patch.ip ?? current.ip, patch.port ?? current.port);
        }
      }
      if (current && !isLocalOnlyId(id)) {
        void settingsApi.printers.update(id, patch as Record<string, unknown>, '')
          .catch(error => reportMutationError(error, 'No se pudo actualizar la impresora'));
      }
      return prev.map(p => (p.id === id ? { ...p, ...patch } : p));
    });
  }, [setSalesPrinters]);

  const removePrinter = useCallback((id: string) => {
    setSalesPrinters(prev => {
      if (!isLocalOnlyId(id)) {
        void settingsApi.printers.remove(id, '')
          .catch(error => reportMutationError(error, 'No se pudo eliminar la impresora'));
      }
      const next = prev.filter(p => p.id !== id);
      if (next.length > 0 && !next.some(p => p.isDefault)) {
        const first = next[0];
        if (first && !isLocalOnlyId(first.id)) {
          void settingsApi.printers.update(first.id, { isDefault: true }, '');
        }
        return next.map((p, i) => (i === 0 ? { ...p, isDefault: true } : p));
      }
      return next;
    });
  }, [setSalesPrinters]);

  const setDefaultPrinter = useCallback((id: string) => {
    setSalesPrinters(prev => {
      for (const p of prev) {
        const nextDefault = p.id === id;
        if (p.isDefault !== nextDefault && !isLocalOnlyId(p.id)) {
          void settingsApi.printers.update(p.id, { isDefault: nextDefault }, '')
            .catch(error => reportMutationError(error, 'No se pudo actualizar la impresora'));
        }
      }
      return prev.map(p => ({ ...p, isDefault: p.id === id }));
    });
  }, [setSalesPrinters]);

  const togglePrinter = useCallback((id: string) => {
    setSalesPrinters(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const connected = !p.connected;
        if (!isLocalOnlyId(id)) {
          void settingsApi.printers.update(id, { connected }, '')
            .catch(error => reportMutationError(error, 'No se pudo actualizar la impresora'));
        }
        return { ...p, connected };
      }),
    );
  }, [setSalesPrinters]);

  const persistSalesTables = useCallback<Dispatch<SetStateAction<SalesTable[]>>>((update) => {
    setSalesTables(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      for (const table of next) {
        const old = prev.find(t => t.id === table.id);
        if (!old) {
          void settingsApi.tables.create({ name: table.name, status: table.status }, '')
            .then(row => {
              const id = String(row.id);
              setSalesTables(current => current.map(t => (t.id === table.id ? { ...t, id } : t)));
            })
            .catch(error => reportMutationError(error, 'No se pudo guardar la mesa'));
        } else if (
          !isLocalOnlyId(table.id)
          && (old.status !== table.status || old.currentOrderId !== table.currentOrderId || old.name !== table.name)
        ) {
          void settingsApi.tables.update(table.id, {
            name: table.name,
            status: table.status,
            currentOrderId: table.currentOrderId ?? null,
          }, '').catch(error => reportMutationError(error, 'No se pudo actualizar la mesa'));
        }
      }
      for (const old of prev) {
        if (!next.some(t => t.id === old.id) && !isLocalOnlyId(old.id)) {
          void settingsApi.tables.remove(old.id, '')
            .catch(error => reportMutationError(error, 'No se pudo eliminar la mesa'));
        }
      }
      return next;
    });
  }, [setSalesTables]);

  const persistTeamAccounts = useCallback<Dispatch<SetStateAction<TeamAccount[]>>>((update) => {
    setTeamAccounts(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      for (const account of next) {
        const old = prev.find(t => t.id === account.id);
        if (!old) {
          void settingsApi.teamAccounts.create({
            team: account.team,
            status: account.status,
            items: account.items,
          }, '')
            .then(row => {
              const id = String(row.id);
              setTeamAccounts(current => current.map(t => (t.id === account.id ? { ...t, id } : t)));
            })
            .catch(error => reportMutationError(error, 'No se pudo guardar la cuenta'));
        } else if (!isLocalOnlyId(account.id) && JSON.stringify(old) !== JSON.stringify(account)) {
          void settingsApi.teamAccounts.update(account.id, {
            team: account.team,
            status: account.status,
            items: account.items,
          }, '').catch(error => reportMutationError(error, 'No se pudo actualizar la cuenta'));
        }
      }
      for (const old of prev) {
        if (!next.some(t => t.id === old.id) && !isLocalOnlyId(old.id)) {
          void settingsApi.teamAccounts.remove(old.id, '')
            .catch(error => reportMutationError(error, 'No se pudo eliminar la cuenta'));
        }
      }
      return next;
    });
  }, [setTeamAccounts]);

  const updateTicketTemplate = useCallback((patch: Partial<TicketTemplate>) => {
    setTicketTemplate(prev => {
      const next = { ...prev, ...patch };
      persistRemoteConfig('sales.ticketTemplate', 'sales', next);
      return next;
    });
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
    setSalesTables: persistSalesTables,
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
    setValidateStockOnSale: (value: boolean) => {
      setValidateStockOnSale(value);
      persistRemoteConfig('sales.validateStockOnSale', 'sales', value);
    },
    raceConditionProtection,
    setRaceConditionProtection: (value: boolean) => {
      setRaceConditionProtection(value);
      persistRemoteConfig('sales.raceConditionProtection', 'sales', value);
    },
    teamAccounts,
    setTeamAccounts: persistTeamAccounts,
  };
}

export type SalesState = ReturnType<typeof useSalesState>;
