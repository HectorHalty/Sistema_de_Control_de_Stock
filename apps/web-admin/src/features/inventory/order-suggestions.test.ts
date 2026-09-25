import { describe, expect, it } from 'vitest';
import { roundUpToOrderUnit, type StockCountType } from './types';
import { buildStockCycleRows, type StockCyclePayload } from './stock-cycles';
import {
  calendarDayInArgentina,
  sessionCalendarDay,
  suggestFromStockCycles,
  type SuggestionCycle,
  type SuggestionSpan,
} from './order-suggestions';

const PRODUCT = 'p1';
const TODAY = '2026-09-14';

/**
 * El ciclo se arma con las sumas crudas y el consumo real lo despeja
 * `buildStockCycleRows`: así el oráculo de este archivo y el de la pantalla de
 * diferencias no pueden separarse.
 */
function cycle(input: {
  day: string;
  dateType: StockCountType;
  hadSales: boolean;
  countedBefore: number | null;
  entradas?: number;
  ventas?: number;
  consumos?: number;
  roturas?: number;
  expected: number;
  counted: number;
}): SuggestionCycle {
  const payload: StockCyclePayload = {
    sessionId: `${input.day}-${input.dateType}`,
    sessionCreatedAt: `${input.day}T18:00:00.000Z`,
    sessionDate: input.day,
    dateType: input.dateType,
    previousSessionId: 'anterior',
    previousCreatedAt: null,
    days: 7,
    hadSales: input.hadSales,
    rows: [{
      productId: PRODUCT,
      productName: 'TEST',
      unit: 'unidades',
      countedBefore: input.countedBefore,
      counted: input.counted,
      expected: input.expected,
      entradas: input.entradas ?? 0,
      devoluciones: 0,
      anulaciones: 0,
      ventas: input.ventas ?? 0,
      consumos: input.consumos ?? 0,
      roturas: input.roturas ?? 0,
      vencidos: 0,
      ajustes: 0,
    }],
  };
  const [row] = buildStockCycleRows(payload);
  return {
    day: input.day,
    dateType: input.dateType,
    hadSales: input.hadSales,
    rows: [{ productId: row.productId, consumoReal: row.consumoReal }],
  };
}

function consumoRealDe(cycleToRead: SuggestionCycle): number | null {
  return cycleToRead.rows[0].consumoReal;
}

// Las tres filas del oráculo. B es un control de verificación: entró un pedido
// y no se vendió nada, así que su diferencia es de recepción.
const FILA_A = { countedBefore: 100, ventas: 50, expected: 50, counted: 46 } as const;
const FILA_B = { countedBefore: 46, entradas: 60, expected: 106, counted: 104 } as const;
const FILA_C = { countedBefore: 104, ventas: 60, consumos: 2, roturas: 1, expected: 41, counted: 38 } as const;

const A = cycle({ day: '2026-09-07', dateType: 'regular', hadSales: true, ...FILA_A });
const B = cycle({ day: '2026-09-10', dateType: 'verificacion', hadSales: false, ...FILA_B });
const C = cycle({ day: '2026-09-14', dateType: 'regular', hadSales: true, ...FILA_C });

const HISTORY: SuggestionCycle[] = [C, B, A];

function suggest(overrides: {
  packRounding: boolean;
  dateType?: 'regular' | 'after';
  span?: SuggestionSpan;
  specificDate?: string;
  cycles?: SuggestionCycle[];
  orderUnit?: number;
  currentStock?: number;
}) {
  return suggestFromStockCycles({
    cycles: overrides.cycles ?? HISTORY,
    productId: PRODUCT,
    currentStock: overrides.currentStock ?? 38,
    orderUnit: overrides.orderUnit ?? 24,
    dateType: overrides.dateType ?? 'regular',
    span: overrides.span ?? 'month',
    specificDate: overrides.specificDate,
    packRounding: overrides.packRounding,
    today: TODAY,
  });
}

/** La fórmula vieja, reproducida para que el contraste no sea una nota al pie. */
function sugeridoConLaFormulaVieja(
  diferencias: number[],
  currentStock: number,
  orderUnit: number,
): number {
  const promedio = diferencias.reduce((a, b) => a + b, 0) / diferencias.length;
  const crudo = promedio - currentStock;
  return crudo <= 0 ? 0 : roundUpToOrderUnit(crudo, orderUnit);
}

describe('suggestFromStockCycles', () => {
  it('el oráculo: los tres ciclos consumieron 54, 2 y 66', () => {
    expect([A, B, C].map(consumoRealDe)).toEqual([54, 2, 66]);
  });

  it('promedia el consumo real de los ciclos con venta y redondea al pack', () => {
    expect(suggest({ packRounding: true, span: 'month' })).toEqual({
      average: 60,
      cyclesUsed: 2,
      raw: 22,
      suggested: 24,
    });
  });

  it('deja el número sin redondear cuando el interruptor está apagado', () => {
    expect(suggest({ packRounding: false, span: 'month' })).toEqual({
      average: 60,
      cyclesUsed: 2,
      raw: 22,
      suggested: 22,
    });
  });

  it('sugiere 24 donde la fórmula vieja, que promediaba la diferencia del conteo, daba 0', () => {
    // La diferencia de A y de C (`esperado − contado`) es 4 y 3: promediarlas da
    // 3,5, y 3,5 − 38 es negativo. Con ticketeo perfecto no reponía nunca.
    expect(sugeridoConLaFormulaVieja([50 - 46, 41 - 38], 38, 24)).toBe(0);
    expect(suggest({ packRounding: true, span: 'month' }).suggested).toBe(24);
  });

  it('un ciclo de verificación dentro de la ventana no mueve el sugerido de regular ni de after', () => {
    const sinVerificacion = [C, A];
    for (const dateType of ['regular', 'after'] as const) {
      expect(suggest({ packRounding: true, span: 'month', dateType })).toEqual(
        suggest({ packRounding: true, span: 'month', dateType, cycles: sinVerificacion }),
      );
      expect(suggest({ packRounding: true, specificDate: '2026-09-10', dateType })).toEqual(
        suggest({ packRounding: true, specificDate: '2026-09-10', dateType, cycles: sinVerificacion }),
      );
    }
  });

  it('un ciclo sin consumo real medible se saltea y no baja el promedio', () => {
    const sinContadoAnterior = cycle({
      day: '2026-09-12', dateType: 'regular', hadSales: true,
      countedBefore: null, ventas: 5, expected: 12, counted: 10,
    });
    expect(consumoRealDe(sinContadoAnterior)).toBeNull();
    expect(suggest({ packRounding: true, span: 'month', cycles: [...HISTORY, sinContadoAnterior] }))
      .toEqual(suggest({ packRounding: true, span: 'month' }));
  });

  it('sin ciclos en la ventana el promedio es 0 y no se pide nada', () => {
    expect(suggest({ packRounding: true, span: 'week', cycles: [A] })).toEqual({
      average: 0,
      cyclesUsed: 0,
      raw: -38,
      suggested: 0,
    });
  });

  it('una fecha puntual usa sólo el ciclo cerrado ese día', () => {
    expect(suggest({ packRounding: true, specificDate: '2026-09-14' })).toEqual({
      average: 66,
      cyclesUsed: 1,
      raw: 28,
      suggested: 48,
    });
    expect(suggest({ packRounding: false, specificDate: '2026-09-14' }).suggested).toBe(28);
  });

  it('la ventana de una semana deja afuera el ciclo del 7', () => {
    expect(suggest({ packRounding: false, span: 'week' })).toEqual({
      average: 66,
      cyclesUsed: 1,
      raw: 28,
      suggested: 28,
    });
  });

  it('no redondea si la unidad de pedido es 1', () => {
    expect(suggest({ packRounding: true, span: 'month', orderUnit: 1 }).suggested).toBe(22);
  });

  it('devuelve 0 cuando el promedio no supera el stock', () => {
    expect(suggest({ packRounding: true, span: 'month', currentStock: 100 })).toMatchObject({
      average: 60,
      suggested: 0,
    });
  });

  it('un ciclo after no entra en una cuenta regular ni al revés', () => {
    const soloAfter = [cycle({ day: '2026-09-14', dateType: 'after', hadSales: true, ...FILA_C })];
    expect(suggest({ packRounding: false, span: 'month', cycles: soloAfter }).cyclesUsed).toBe(0);
    expect(suggest({ packRounding: false, span: 'month', cycles: soloAfter, dateType: 'after' }))
      .toMatchObject({ average: 66, cyclesUsed: 1, suggested: 28 });
  });

  it('últimos 6 meses usa la misma cuenta a 180 días', () => {
    expect(suggest({ packRounding: false, span: 'halfYear' })).toEqual(
      suggest({ packRounding: false, span: 'quarter' }),
    );
  });

  it('un ISO con hora del día de cierre cuenta como ese día y no como el anterior', () => {
    const conHora = [cycle({
      day: '2026-09-14T00:30:00.000Z', dateType: 'regular', hadSales: true, ...FILA_C,
    })];
    expect(suggest({ packRounding: false, specificDate: '2026-09-14', cycles: conHora }).cyclesUsed).toBe(1);
  });

  it('un texto que no es fecha no entra en la ventana', () => {
    expect(sessionCalendarDay('sin-fecha')).toBe('');
    expect(calendarDayInArgentina(new Date('2026-09-14T15:00:00-03:00'))).toBe('2026-09-14');
    const sinFecha = [cycle({ day: 'sin-fecha', dateType: 'regular', hadSales: true, ...FILA_C })];
    expect(suggest({ packRounding: false, span: 'month', cycles: sinFecha }).cyclesUsed).toBe(0);
  });
});
