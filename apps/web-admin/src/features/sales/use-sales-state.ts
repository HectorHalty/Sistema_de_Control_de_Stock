import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import type { AuditEntry, AuditModule } from '@/features/inventory/types';
import { initialKitchens, initialSalesProducts, initialTables } from './seeds';
import type { Kitchen, SalesHistoryEntry, SalesProduct, SalesTable, SalesTicket } from './types';

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
  const [kitchens, setKitchens] = useLocalStorage<Kitchen[]>(storageKeys.sales.kitchens, initialKitchens);
  const [salesProducts, setSalesProducts] = useLocalStorage<SalesProduct[]>(storageKeys.sales.products, initialSalesProducts);
  const [salesTickets, setSalesTickets] = useLocalStorage<SalesTicket[]>(storageKeys.sales.tickets, []);
  const [salesTicketCounter, setSalesTicketCounter] = useLocalStorage<number>(storageKeys.sales.ticketCounter, 1000);
  const [salesTables, setSalesTables] = useLocalStorage<SalesTable[]>(storageKeys.sales.tables, initialTables);
  const [salesHistory, setSalesHistory] = useLocalStorage<SalesHistoryEntry[]>(storageKeys.sales.history, []);
  const [salesAuditLog, setSalesAuditLog] = useLocalStorage<AuditEntry[]>(storageKeys.sales.auditLog, []);

  const addSalesAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'date' | 'module'>) => {
    appendAudit(setSalesAuditLog, 'ventas', entry);
  }, [setSalesAuditLog]);

  return {
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
  };
}

export type SalesState = ReturnType<typeof useSalesState>;
