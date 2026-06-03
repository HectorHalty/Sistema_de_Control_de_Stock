import type { AuditEntry } from '@/features/inventory/types';

export type AuditModule = 'stock' | 'ventas';

export function inferAuditModule(entry: Pick<AuditEntry, 'action' | 'module'>): AuditModule {
  if (entry.module === 'stock' || entry.module === 'ventas') return entry.module;
  const action = entry.action.toLowerCase();
  if (
    action.includes('venta') ||
    action.includes('ticket') ||
    action.includes('anul') ||
    action.includes('devol') ||
    action.includes('caja')
  ) {
    return 'ventas';
  }
  return 'stock';
}

export function isStockAuditEntry(entry: AuditEntry): boolean {
  return inferAuditModule(entry) === 'stock';
}

export function isVentasAuditEntry(entry: AuditEntry): boolean {
  return inferAuditModule(entry) === 'ventas';
}

export function getStockAuditEntries(stockLog: AuditEntry[], salesLog: AuditEntry[]): AuditEntry[] {
  const fromStock = stockLog.filter(isStockAuditEntry);
  const misplacedInSales = salesLog.filter(isStockAuditEntry);
  return [...fromStock, ...misplacedInSales];
}

export function getVentasAuditEntries(stockLog: AuditEntry[], salesLog: AuditEntry[]): AuditEntry[] {
  const fromSales = salesLog.filter(isVentasAuditEntry);
  const legacyInStock = stockLog.filter(isVentasAuditEntry);
  return [...fromSales, ...legacyInStock];
}
