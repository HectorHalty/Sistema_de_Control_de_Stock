import { describe, expect, it } from 'vitest';
import type { StockCountSession } from './types';
import { calendarDayInArgentina, sessionCalendarDay, suggestFromStockCounts, type SuggestionSpan } from './order-suggestions';

const PRODUCT = 'p1';
const TODAY = '2026-09-23';

function session(
  date: string,
  dateType: StockCountSession['dateType'],
  consumed: number,
): StockCountSession {
  return {
    id: `${date}-${dateType}-${consumed}`,
    createdAtISO: `${date.slice(0, 10)}T15:00:00.000Z`,
    date,
    dateType,
    entries: [{
      productId: PRODUCT,
      productName: 'TEST',
      unit: 'unidades',
      expected: consumed >= 0 ? consumed : 0,
      counted: consumed >= 0 ? 0 : -consumed,
    }],
  };
}

const history: StockCountSession[] = [
  session('2026-09-23', 'regular', 10),
  session('2026-09-21', 'regular', 30),
  session('2026-09-22', 'regular', 20),
  session('2026-09-01', 'regular', 50),
  session('2026-07-23', 'regular', 10),
  session('2026-09-22', 'after', 40),
];

function suggest(overrides: {
  packRounding: boolean;
  dateType?: 'regular' | 'after';
  span?: SuggestionSpan;
  specificDate?: string;
  sessions?: StockCountSession[];
  orderUnit?: number;
  currentStock?: number;
}) {
  return suggestFromStockCounts({
    sessions: overrides.sessions ?? history,
    productId: PRODUCT,
    currentStock: overrides.currentStock ?? 10,
    orderUnit: overrides.orderUnit ?? 24,
    dateType: overrides.dateType ?? 'regular',
    span: overrides.span ?? 'month',
    specificDate: overrides.specificDate,
    packRounding: overrides.packRounding,
    today: TODAY,
  });
}

describe('suggestFromStockCounts', () => {
  it('redondea al pack las seis selecciones del oráculo', () => {
    expect(suggest({ packRounding: true, specificDate: '2026-09-21' }).suggested).toBe(24);
    expect(suggest({ packRounding: true, span: 'week' }).suggested).toBe(24);
    expect(suggest({ packRounding: true, span: 'month' }).suggested).toBe(24);
    expect(suggest({ packRounding: true, span: 'quarter' }).suggested).toBe(24);
    expect(suggest({ packRounding: true, dateType: 'after', specificDate: '2026-09-22' }).suggested).toBe(48);
    expect(suggest({ packRounding: true, dateType: 'after', span: 'week' }).suggested).toBe(48);
  });

  it('deja el número sin redondear cuando el interruptor está apagado', () => {
    expect(suggest({ packRounding: false, specificDate: '2026-09-21' })).toMatchObject({ raw: 20, suggested: 20 });
    expect(suggest({ packRounding: false, span: 'week' })).toMatchObject({ raw: 10, suggested: 10 });
    expect(suggest({ packRounding: false, span: 'month' })).toMatchObject({ raw: 17.5, suggested: 17.5 });
    expect(suggest({ packRounding: false, span: 'quarter' })).toMatchObject({ raw: 14, suggested: 14 });
    expect(suggest({ packRounding: false, dateType: 'after', specificDate: '2026-09-22' })).toMatchObject({ raw: 30, suggested: 30 });
    expect(suggest({ packRounding: false, dateType: 'after', span: 'week' })).toMatchObject({ raw: 30, suggested: 30 });
  });

  it('un consumido negativo baja el promedio de la semana y no mueve la fecha puntual', () => {
    const sessions = [...history, session('2026-09-20', 'regular', -10)];
    expect(suggest({ packRounding: false, span: 'week', sessions })).toMatchObject({ raw: 2.5, suggested: 2.5 });
    expect(suggest({ packRounding: false, specificDate: '2026-09-21', sessions }).suggested).toBe(20);
  });

  it('no redondea si la unidad de pedido es 1', () => {
    expect(suggest({ packRounding: true, span: 'month', orderUnit: 1 }).suggested).toBe(17.5);
  });

  it('devuelve 0 cuando el promedio no supera el stock', () => {
    expect(suggest({ packRounding: true, span: 'week', currentStock: 100 }).suggested).toBe(0);
  });

  it('un ISO con hora del 2026-09-23 cuenta como ese día y no como el anterior', () => {
    const sessions = [session('2026-09-23T00:30:00.000Z', 'regular', 30)];
    expect(suggest({
      packRounding: false,
      specificDate: '2026-09-23',
      sessions,
      currentStock: 10,
      orderUnit: 1,
    }).suggested).toBe(20);
  });

  it('últimos 6 meses usa la misma cuenta a 180 días', () => {
    expect(suggest({ packRounding: false, span: 'halfYear' })).toEqual(
      suggest({ packRounding: false, span: 'quarter' }),
    );
  });

  it('un texto que no es fecha no entra en la ventana', () => {
    expect(sessionCalendarDay('sin-fecha')).toBe('');
    expect(calendarDayInArgentina(new Date('2026-09-23T15:00:00-03:00'))).toBe('2026-09-23');
    const sessions = [session('sin-fecha', 'regular', 30)];
    expect(suggest({ packRounding: false, span: 'week', sessions }).suggested).toBe(0);
  });

  it('un control after no entra en una cuenta regular', () => {
    const onlyAfter = [session('2026-09-22', 'after', 40)];
    expect(suggest({ packRounding: false, span: 'week', sessions: onlyAfter, dateType: 'regular' }).suggested).toBe(0);
  });

  it('un control de verificación no mueve el sugerido de regular ni de after', () => {
    const conVerificacion = [...history, session('2026-09-22', 'verificacion', 999)];
    for (const dateType of ['regular', 'after'] as const) {
      expect(suggest({ packRounding: false, span: 'week', sessions: conVerificacion, dateType })).toEqual(
        suggest({ packRounding: false, span: 'week', dateType }),
      );
      expect(suggest({ packRounding: true, specificDate: '2026-09-22', sessions: conVerificacion, dateType })).toEqual(
        suggest({ packRounding: true, specificDate: '2026-09-22', dateType }),
      );
    }
  });
});
