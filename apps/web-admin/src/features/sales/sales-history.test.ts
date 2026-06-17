import { describe, it, expect } from 'vitest';
import { historyFromTickets, mergeSalesHistory, mergeTicketsFromServer } from './sales-history';
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

  it('no borra tickets locales recientes al fusionar con servidor desactualizado', () => {
    const server: SalesTicket[] = [baseTicket];
    const local: SalesTicket[] = [
      baseTicket,
      { ...baseTicket, id: 't-new', number: 1002, createdAtISO: '2026-06-17T13:00:00.000Z' },
    ];
    const merged = mergeTicketsFromServer(server, local);
    expect(merged).toHaveLength(2);
    expect(merged.some(t => t.id === 't-new')).toBe(true);
  });

  it('el servidor gana cuando el mismo id existe en ambos lados', () => {
    const server: SalesTicket[] = [{ ...baseTicket, total: 200 }];
    const local: SalesTicket[] = [{ ...baseTicket, total: 50 }];
    const merged = mergeTicketsFromServer(server, local);
    expect(merged).toHaveLength(1);
    expect(merged[0].total).toBe(200);
  });
});
