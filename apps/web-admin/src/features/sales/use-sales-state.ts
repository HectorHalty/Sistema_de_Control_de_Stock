import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import type { AuditEntry, AuditModule } from '@/features/inventory/types';
import { DEFAULT_SALES_CATEGORIES, normalizeCategoryName } from './lib/sales-categories';
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
    salesProducts,
    setSalesProducts,
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
