import { describe, expect, it } from 'vitest';
import type { StockCountSession } from './types';
import { findLastCountSession, lastCountAgeLabel } from './last-count';

const PRODUCT = 'p1';
const TODAY = '2026-09-25';

function session(input: {
  id: string;
  date: string;
  createdAtISO: string;
  productIds: string[];
}): StockCountSession {
  return {
    id: input.id,
    createdAtISO: input.createdAtISO,
    date: input.date,
    dateType: 'regular',
    entries: input.productIds.map(productId => ({
      productId,
      productName: productId,
      unit: 'unidades',
      expected: 10,
      counted: 9,
    })),
  };
}

const HOY = session({
  id: 's-hoy',
  date: '2026-09-25',
  createdAtISO: '2026-09-25T12:00:00.000Z',
  productIds: [PRODUCT],
});
const AYER_DE_NOCHE = session({
  id: 's-ayer',
  date: '2026-09-24',
  createdAtISO: '2026-09-25T02:00:00.000Z',
  productIds: [PRODUCT],
});
const VIEJO = session({
  id: 's-viejo',
  date: '2026-09-18',
  createdAtISO: '2026-09-18T15:00:00.000Z',
  productIds: [PRODUCT, 'p2'],
});

describe('findLastCountSession', () => {
  it('devuelve el control más reciente que incluyó al producto', () => {
    expect(findLastCountSession([VIEJO, HOY, AYER_DE_NOCHE], PRODUCT)?.id).toBe('s-hoy');
  });

  it('devuelve null para un producto que nunca se contó', () => {
    expect(findLastCountSession([VIEJO, HOY], 'nunca-contado')).toBeNull();
  });

  it('ignora los controles más nuevos que no incluyen al producto', () => {
    expect(findLastCountSession([VIEJO, HOY, AYER_DE_NOCHE], 'p2')?.id).toBe('s-viejo');
  });

  it('sin controles no hay último control', () => {
    expect(findLastCountSession([], PRODUCT)).toBeNull();
  });
});

describe('lastCountAgeLabel', () => {
  it('un control del mismo día es hoy', () => {
    expect(lastCountAgeLabel({ sessions: [HOY], productId: PRODUCT, today: TODAY })).toBe('hoy');
  });

  it('un control del día anterior es ayer, aunque sea de hace pocas horas', () => {
    expect(lastCountAgeLabel({ sessions: [AYER_DE_NOCHE], productId: PRODUCT, today: TODAY })).toBe('ayer');
  });

  it('un control más viejo se cuenta en días', () => {
    expect(lastCountAgeLabel({ sessions: [VIEJO], productId: PRODUCT, today: TODAY })).toBe('hace 7 días');
  });

  it('un producto que nunca se contó no tiene antigüedad', () => {
    expect(lastCountAgeLabel({ sessions: [HOY, VIEJO], productId: 'nunca-contado', today: TODAY })).toBe('sin control');
  });

  it('un producto contado en un control viejo y no en el último usa el viejo', () => {
    expect(lastCountAgeLabel({ sessions: [HOY, VIEJO], productId: 'p2', today: TODAY })).toBe('hace 7 días');
  });

  it('el formato de pantalla (25/9/2026 13:12) no se parsea y el día sale del instante', () => {
    // 2026-09-23T22:00:00Z son las 19:00 del 23 en Argentina: dos días atrás.
    const desdePantalla = session({
      id: 's-pantalla',
      date: '23/9/2026 19:00',
      createdAtISO: '2026-09-23T22:00:00.000Z',
      productIds: [PRODUCT],
    });
    expect(lastCountAgeLabel({ sessions: [desdePantalla], productId: PRODUCT, today: TODAY })).toBe('hace 2 días');
  });

  it('un control guardado pasada la medianoche UTC sigue siendo del día argentino', () => {
    // 2026-09-25T02:00:00Z son las 23:00 del 24 en Argentina: ayer, no hoy.
    const cruzandoMedianoche = session({
      id: 's-cruce',
      date: '24/9/2026 23:00',
      createdAtISO: '2026-09-25T02:00:00.000Z',
      productIds: [PRODUCT],
    });
    expect(lastCountAgeLabel({ sessions: [cruzandoMedianoche], productId: PRODUCT, today: TODAY })).toBe('ayer');
  });
});
