import { describe, expect, it } from 'vitest';
import {
  buildStockCycleRows,
  buildStockCycleTotals,
  type StockCyclePayload,
  type StockCyclePayloadRow,
} from './stock-cycles';

const PRODUCT = 'p1';

function row(overrides: Partial<StockCyclePayloadRow>): StockCyclePayloadRow {
  return {
    productId: PRODUCT,
    productName: 'Pan de hamburguesa',
    unit: 'unidades',
    countedBefore: 0,
    counted: 0,
    expected: 0,
    entradas: 0,
    devoluciones: 0,
    anulaciones: 0,
    ventas: 0,
    consumos: 0,
    roturas: 0,
    vencidos: 0,
    ajustes: 0,
    ...overrides,
  };
}

function payload(
  rows: StockCyclePayloadRow[],
  overrides: Partial<StockCyclePayload> = {},
): StockCyclePayload {
  return {
    sessionId: 's1',
    sessionCreatedAt: '2026-09-08T15:00:00.000Z',
    sessionDate: '2026-09-08',
    dateType: 'regular',
    previousSessionId: 's0',
    previousCreatedAt: '2026-09-01T15:00:00.000Z',
    days: 7,
    hadSales: true,
    rows,
    ...overrides,
  };
}

/**
 * Oráculo de tres ciclos del mismo producto. El del medio es un control de
 * pedido recibido: entró mercadería y no se vendió nada.
 */
const CICLO_A = payload(
  [row({ countedBefore: 100, ventas: 50, expected: 50, counted: 46 })],
  { hadSales: true },
);
const CICLO_B = payload(
  [row({ countedBefore: 46, entradas: 60, expected: 106, counted: 104 })],
  { hadSales: false, dateType: 'verificacion', days: 2 },
);
const CICLO_C = payload(
  [row({ countedBefore: 104, ventas: 60, consumos: 2, roturas: 1, expected: 41, counted: 38 })],
  { hadSales: true },
);

describe('buildStockCycleRows', () => {
  it('cierra el ciclo A: 50 de salidas explicadas y 4 que el conteo corrigió', () => {
    const [r] = buildStockCycleRows(CICLO_A);
    expect(r.adiciones).toBe(0);
    expect(r.salidas).toBe(50);
    expect(r.esperadoCalculado).toBe(50);
    expect(r.diferencia).toBe(4);
    expect(r.consumoReal).toBe(54);
    expect(r.porcentajeDiferencia).toBe(7.407);
    expect(r.cierra).toBe(true);
    expect(r.sinContadoAnterior).toBe(false);
    expect(CICLO_A.hadSales).toBe(true);
  });

  it('cierra el ciclo B, un control de pedido sin ventas: el consumo real son las 2 de la diferencia', () => {
    const [r] = buildStockCycleRows(CICLO_B);
    expect(r.adiciones).toBe(60);
    expect(r.salidas).toBe(0);
    expect(r.esperadoCalculado).toBe(106);
    expect(r.diferencia).toBe(2);
    expect(r.consumoReal).toBe(2);
    expect(r.porcentajeDiferencia).toBe(100);
    expect(r.cierra).toBe(true);
    expect(CICLO_B.hadSales).toBe(false);
  });

  it('cierra el ciclo C sumando ventas, consumos y roturas', () => {
    const [r] = buildStockCycleRows(CICLO_C);
    expect(r.adiciones).toBe(0);
    expect(r.salidas).toBe(63);
    expect(r.esperadoCalculado).toBe(41);
    expect(r.diferencia).toBe(3);
    expect(r.consumoReal).toBe(66);
    expect(r.porcentajeDiferencia).toBe(4.545);
    expect(r.cierra).toBe(true);
    expect(CICLO_C.hadSales).toBe(true);
  });

  it('en los tres ciclos el consumo real es lo que el libro explica más la diferencia', () => {
    for (const cycle of [CICLO_A, CICLO_B, CICLO_C]) {
      const [r] = buildStockCycleRows(cycle);
      expect(r.consumoReal).toBe(r.salidas + (r.diferencia ?? 0));
    }
  });

  it('un ajuste positivo suma a las adiciones y uno negativo a las salidas', () => {
    const [positivo] = buildStockCycleRows(
      payload([row({ countedBefore: 10, ajustes: 4, expected: 14, counted: 14 })]),
    );
    expect(positivo.adiciones).toBe(4);
    expect(positivo.salidas).toBe(0);
    expect(positivo.esperadoCalculado).toBe(14);

    const [negativo] = buildStockCycleRows(
      payload([row({ countedBefore: 10, ajustes: -4, expected: 6, counted: 6 })]),
    );
    expect(negativo.adiciones).toBe(0);
    expect(negativo.salidas).toBe(4);
    expect(negativo.esperadoCalculado).toBe(6);
  });

  it('marca la fila sin contado anterior sin dar por hecho que el control previo contó cero', () => {
    const [r] = buildStockCycleRows(
      payload([row({ countedBefore: null, ventas: 5, expected: 12, counted: 11 })]),
    );
    expect(r.sinContadoAnterior).toBe(true);
    expect(r.esperadoCalculado).toBeNull();
    expect(r.consumoReal).toBeNull();
    expect(r.porcentajeDiferencia).toBeNull();
    expect(r.cierra).toBe(false);
    // La diferencia no necesita el contado anterior: el control la guardó.
    expect(r.diferencia).toBe(1);
  });

  it('no cierra cuando las sumas no explican el esperado que guardó el control', () => {
    const [r] = buildStockCycleRows(
      payload([row({ countedBefore: 100, ventas: 50, expected: 47, counted: 46 })]),
    );
    expect(r.esperadoCalculado).toBe(50);
    expect(r.cierra).toBe(false);
    expect(r.diferencia).toBe(1);
  });

  it('el ciclo abierto no inventa contado ni diferencia', () => {
    const [r] = buildStockCycleRows(
      payload([row({ countedBefore: 38, ventas: 5, counted: null, expected: null })], {
        sessionId: 'current',
        sessionCreatedAt: null,
        sessionDate: null,
        dateType: null,
      }),
    );
    expect(r.esperadoCalculado).toBe(33);
    expect(r.diferencia).toBeNull();
    expect(r.consumoReal).toBeNull();
    expect(r.porcentajeDiferencia).toBeNull();
    expect(r.cierra).toBe(false);
  });

  it('el porcentaje es 0 y no Infinity cuando no salió nada', () => {
    const [r] = buildStockCycleRows(
      payload([row({ countedBefore: 10, expected: 10, counted: 10 })]),
    );
    expect(r.consumoReal).toBe(0);
    expect(r.diferencia).toBe(0);
    expect(r.porcentajeDiferencia).toBe(0);
  });

  it('redondea a tres decimales', () => {
    const [r] = buildStockCycleRows(
      payload([
        row({ countedBefore: 1.5, ventas: 0.1, consumos: 0.2, expected: 1.2, counted: 1.199 }),
      ]),
    );
    expect(r.salidas).toBe(0.3);
    expect(r.esperadoCalculado).toBe(1.2);
    expect(r.diferencia).toBe(0.001);
    expect(r.cierra).toBe(true);
  });
});

describe('buildStockCycleTotals', () => {
  it('suma las filas: lo que salió, lo que el libro explica y lo que no', () => {
    const rows = buildStockCycleRows(
      payload([
        row({ productId: 'a', productName: 'A', countedBefore: 100, ventas: 50, expected: 50, counted: 46 }),
        row({ productId: 'b', productName: 'B', countedBefore: 46, entradas: 60, expected: 106, counted: 104 }),
        row({ productId: 'c', productName: 'C', countedBefore: 104, ventas: 60, consumos: 2, roturas: 1, expected: 41, counted: 38 }),
      ]),
    );

    expect(buildStockCycleTotals(rows)).toEqual({
      consumoReal: 122,
      salidas: 113,
      diferencia: 9,
      filasIncompletas: 0,
    });
  });

  it('el pie cierra: lo que salió es lo que el libro explica más lo que no', () => {
    const rows = buildStockCycleRows(
      payload([
        row({ productId: 'a', productName: 'A', countedBefore: 100, ventas: 50, expected: 50, counted: 46 }),
        row({ productId: 'c', productName: 'C', countedBefore: 104, ventas: 60, consumos: 2, roturas: 1, expected: 41, counted: 38 }),
      ]),
    );
    const totals = buildStockCycleTotals(rows);
    expect(totals.consumoReal).toBe(totals.salidas + totals.diferencia);
  });

  it('cuenta aparte las filas sin contado anterior en vez de desbalancear el pie', () => {
    const rows = buildStockCycleRows(
      payload([
        row({ productId: 'a', productName: 'A', countedBefore: 100, ventas: 50, expected: 50, counted: 46 }),
        row({ productId: 'b', productName: 'B', countedBefore: null, ventas: 8, expected: 8, counted: 8 }),
      ]),
    );

    const totals = buildStockCycleTotals(rows);
    expect(totals.consumoReal).toBe(54);
    expect(totals.salidas).toBe(50);
    expect(totals.diferencia).toBe(4);
    expect(totals.filasIncompletas).toBe(1);
  });

  it('en el ciclo abierto no hay nada que cerrar: todas las filas quedan incompletas', () => {
    const rows = buildStockCycleRows(
      payload(
        [row({ countedBefore: 38, ventas: 5, roturas: 1, counted: null, expected: null })],
        { sessionId: 'current', sessionCreatedAt: null, sessionDate: null, dateType: null },
      ),
    );

    expect(buildStockCycleTotals(rows)).toEqual({
      consumoReal: 0,
      salidas: 0,
      diferencia: 0,
      filasIncompletas: 1,
    });
  });

  it('sin filas devuelve todo en cero', () => {
    expect(buildStockCycleTotals([])).toEqual({
      consumoReal: 0,
      salidas: 0,
      diferencia: 0,
      filasIncompletas: 0,
    });
  });
});
