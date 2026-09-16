import { describe, expect, it } from 'vitest';
import type { Kitchen, SalesProduct, SalesTicket } from '@/app/components/store';
import { buildStockMovementsFromCart, ticketToPos } from './VentasPosContext';

const kitchens: Kitchen[] = [{ id: 'k1', name: 'Parrilla', emoji: '🔥', active: true }];

function ticket(over: Partial<SalesTicket> = {}): SalesTicket {
  return {
    id: 't1',
    number: 12,
    createdAtISO: '2026-09-11T15:00:00.000Z',
    status: 'emitido',
    items: [
      { salesProductId: 'sp1', name: 'Burger', unitPrice: 1000, quantity: 2, kitchenId: 'k1' },
    ],
    total: 2000,
    operatorId: 'u1',
    operatorName: 'Ana',
    ...over,
  };
}

describe('ticketToPos', () => {
  it('marca Mostrador si la nota no es Mesa:', () => {
    const pos = ticketToPos(ticket({ note: 'Mostrador' }), 'Ana', kitchens);
    expect(pos.source).toBe('Mostrador');
    expect(pos.kind).toBe('venta');
    expect(pos.items[0].station).toBe('Parrilla');
  });

  it('marca Mesa si note empieza con Mesa:', () => {
    expect(ticketToPos(ticket({ note: 'Mesa: 4' }), 'Ana', kitchens).source).toBe('Mesa');
  });

  it('kind consumo si origen=consumo', () => {
    expect(ticketToPos(ticket({ origen: 'consumo', total: 0 }), 'Ana', kitchens).kind).toBe(
      'consumo',
    );
  });

  it('kind devolucion si status=devuelto', () => {
    expect(ticketToPos(ticket({ status: 'devuelto' }), 'Ana', kitchens).kind).toBe('devolucion');
  });
});

describe('buildStockMovementsFromCart', () => {
  const salesProducts: SalesProduct[] = [
    {
      id: 'sp1',
      name: 'Burger',
      category: 'Comidas',
      categoriaVentaId: 'c1',
      kitchenId: 'k1',
      price: 1000,
      emoji: '🍔',
      kind: 'simple',
      active: true,
      recipe: [{ stockProductId: 'pan', quantity: 1 }],
      bundle: [],
    },
  ];

  it('venta (direction -1) emite salida de stock', () => {
    const rows = buildStockMovementsFromCart(
      [{ salesProductId: 'sp1', quantity: 2 }],
      salesProducts,
      'venta',
      -1,
      'ticket-12',
      { id: 'u1', name: 'Ana' },
    );
    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'pan',
        quantity: -2,
        type: 'venta',
        reference: 'ticket-12',
      }),
    ]);
  });
});
