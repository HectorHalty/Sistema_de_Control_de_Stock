import { describe, it, expect } from 'vitest';
import { historyFromTickets, mergeSalesHistory } from './sales-history';
import type { SalesTicket } from './types';

describe('sales-history', () => {
  const baseTicket: SalesTicket = {
    id: 't1',
    number: 1001,
    createdAtISO: '2026-06-17T12:00:00.000Z',
    status: 'emitido',
    items: [],
    total: 100,
    operatorId: 'op1',
    operatorName: 'Caja',
  };

  it('deriva venta, anulación y devolución desde tickets', () => {
    const rows = historyFromTickets([
      baseTicket,
      { ...baseTicket, id: 't2', number: 1002, status: 'anulado' },
      { ...baseTicket, id: 't3', number: 1003, status: 'devuelto' },
    ]);
    expect(rows.map(r => r.type)).toEqual(['venta', 'anulacion', 'devolucion']);
  });

  it('conserva entradas locales de configuración al fusionar', () => {
    const fromServer = historyFromTickets([baseTicket]);
    const merged = mergeSalesHistory(fromServer, [
      {
        id: 'local-1',
        timestampISO: '2026-06-16T10:00:00.000Z',
        operatorId: 'op1',
        operatorName: 'Admin',
        type: 'producto_creado',
        detail: 'Nuevo producto',
      },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.some(e => e.type === 'producto_creado')).toBe(true);
  });
});
