import { describe, expect, it } from 'vitest';
import { splitTicketByStation, ticketPickupStation } from './split-ticket-by-station';
import type { PosTicket } from '@/features/sales/pos/VentasPosContext';

const baseTicket = (): PosTicket => ({
  id: 't-1',
  number: 42,
  createdAt: '01/01/2026, 12:00:00',
  createdAtISO: '2026-01-01T15:00:00.000Z',
  total: 0,
  status: 'emitido',
  kind: 'venta',
  source: 'Mostrador',
  operator: 'Ana',
  operatorId: 'u-1',
  items: [],
});

describe('splitTicketByStation', () => {
  it('devuelve un solo ticket cuando todos los ítems son de la misma estación', () => {
    const ticket: PosTicket = {
      ...baseTicket(),
      items: [
        { productId: 'a', name: 'Fernet', price: 1000, qty: 2, station: 'Barra' },
        { productId: 'b', name: 'Coca', price: 500, qty: 1, station: 'Barra' },
      ],
      total: 2500,
    };

    const splits = splitTicketByStation(ticket);
    expect(splits).toHaveLength(1);
    expect(splits[0].pickupStation).toBe('Barra');
    expect(splits[0].items).toHaveLength(2);
    expect(splits[0].total).toBe(2500);
  });

  it('genera un ticket por cada estación distinta', () => {
    const ticket: PosTicket = {
      ...baseTicket(),
      items: [
        { productId: 'a', name: 'Hamburguesa', price: 3000, qty: 1, station: 'Parrilla' },
        { productId: 'b', name: 'Cerveza', price: 2000, qty: 2, station: 'Barra' },
      ],
      total: 7000,
    };

    const splits = splitTicketByStation(ticket);
    expect(splits).toHaveLength(2);

    const parrilla = splits.find(s => s.pickupStation === 'Parrilla')!;
    const barra = splits.find(s => s.pickupStation === 'Barra')!;
    expect(parrilla.total).toBe(3000);
    expect(barra.total).toBe(4000);
    expect(parrilla.number).toBe(42);
    expect(barra.number).toBe(42);
  });

  it('agrupa ítems sin estación bajo cadena vacía', () => {
    const ticket: PosTicket = {
      ...baseTicket(),
      items: [{ productId: 'a', name: 'Agua', price: 500, qty: 1 }],
      total: 500,
    };

    const splits = splitTicketByStation(ticket);
    expect(splits).toHaveLength(1);
    expect(splits[0].pickupStation).toBe('');
  });
});

describe('ticketPickupStation', () => {
  it('devuelve la estación cuando es única', () => {
    const ticket: PosTicket = {
      ...baseTicket(),
      items: [{ productId: 'a', name: 'Pizza', price: 1000, qty: 1, station: 'Cocina' }],
      total: 1000,
    };
    expect(ticketPickupStation(ticket)).toBe('Cocina');
  });

  it('devuelve undefined si hay varias estaciones', () => {
    const ticket: PosTicket = {
      ...baseTicket(),
      items: [
        { productId: 'a', name: 'Pizza', price: 1000, qty: 1, station: 'Cocina' },
        { productId: 'b', name: 'Cerveza', price: 800, qty: 1, station: 'Barra' },
      ],
      total: 1800,
    };
    expect(ticketPickupStation(ticket)).toBeUndefined();
  });
});
