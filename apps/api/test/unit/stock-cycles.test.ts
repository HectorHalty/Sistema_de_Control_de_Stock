import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { StockService } from '../../src/stock/stock.service';
import type { PrismaService } from '../../src/common/prisma.service';

/**
 * El ciclo se define por la ventana de `createdAt` que se le manda a Prisma.
 * Acá se fija esa consulta: los límites, los tipos excluidos y que la suma sea
 * un solo groupBy. El comportamiento contra datos reales está en
 * test/db/stock-cycles.test.ts.
 */

const T_PREV = new Date('2026-09-01T15:00:00.000Z');
const T_SESSION = new Date('2026-09-08T15:00:00.000Z');

type FakeEntry = {
  productId: string;
  productName: string;
  unit: string;
  expected: number;
  counted: number;
};

type FakeSession = {
  id: string;
  createdAt: Date;
  date: string;
  dateType: string;
  entries: FakeEntry[];
};

function session(id: string, createdAt: Date, entries: FakeEntry[]): FakeSession {
  return { id, createdAt, date: createdAt.toISOString().slice(0, 10), dateType: 'regular', entries };
}

function entry(productId: string, expected: number, counted: number): FakeEntry {
  return { productId, productName: productId.toUpperCase(), unit: 'unidades', expected, counted };
}

function harness(opts: {
  session?: FakeSession | null;
  previous?: FakeSession | null;
  grouped?: Array<{ productId: string; type: string; reason: string | null; _sum: { quantity: number } }>;
  catalog?: Array<{ id: string; name: string; unit: string }>;
}) {
  const findUnique = vi.fn().mockResolvedValue(opts.session ?? null);
  const findFirst = vi.fn().mockResolvedValue(opts.previous ?? null);
  const groupBy = vi.fn().mockResolvedValue(opts.grouped ?? []);
  const productFindMany = vi.fn().mockResolvedValue(opts.catalog ?? []);
  const prisma = {
    sesionConteo: { findUnique, findFirst },
    movimientoStock: { groupBy },
    producto: { findMany: productFindMany },
  } as unknown as PrismaService;
  return {
    service: new StockService(prisma, {} as never),
    findUnique,
    findFirst,
    groupBy,
    productFindMany,
  };
}

describe('StockService.findStockCycle', () => {
  it('suma con un solo groupBy por producto, tipo y motivo', async () => {
    const h = harness({
      session: session('s1', T_SESSION, [entry('p1', 50, 46)]),
      previous: session('s0', T_PREV, [entry('p1', 100, 100)]),
    });
    await h.service.findStockCycle('s1');

    expect(h.groupBy).toHaveBeenCalledOnce();
    const args = h.groupBy.mock.calls[0][0];
    expect(args.by).toEqual(['productId', 'type', 'reason']);
    expect(args._sum).toEqual({ quantity: true });
  });

  it('la ventana es (anterior, cierre] y excluye diferencia_conteo y pasaje', async () => {
    const h = harness({
      session: session('s1', T_SESSION, [entry('p1', 50, 46)]),
      previous: session('s0', T_PREV, [entry('p1', 100, 100)]),
    });
    await h.service.findStockCycle('s1');

    const where = h.groupBy.mock.calls[0][0].where;
    expect(where.createdAt).toEqual({ gt: T_PREV, lte: T_SESSION });
    expect(where.type).toEqual({ notIn: ['diferencia_conteo', 'pasaje'] });
    // El anterior es el más reciente estrictamente antes del cierre.
    expect(h.findFirst.mock.calls[0][0]).toMatchObject({
      where: { createdAt: { lt: T_SESSION } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('sin control anterior la ventana queda abierta al inicio y no falla', async () => {
    const h = harness({
      session: session('s1', T_SESSION, [entry('p1', 100, 93)]),
      previous: null,
      grouped: [{ productId: 'p1', type: 'venta', reason: null, _sum: { quantity: -7 } }],
    });
    const cycle = await h.service.findStockCycle('s1');

    expect(h.groupBy.mock.calls[0][0].where.createdAt).toEqual({ lte: T_SESSION });
    expect(cycle.previousSessionId).toBeNull();
    expect(cycle.previousCreatedAt).toBeNull();
    expect(cycle.days).toBe(1);
    expect(cycle.rows[0].countedBefore).toBeNull();
    expect(cycle.rows[0].ventas).toBe(7);
  });

  it('"current" arranca en el último control y no tiene cierre', async () => {
    const h = harness({
      previous: session('s1', T_SESSION, [entry('p1', 50, 46)]),
      grouped: [{ productId: 'p1', type: 'venta', reason: null, _sum: { quantity: -5 } }],
    });
    const cycle = await h.service.findStockCycle('current');

    expect(h.findUnique).not.toHaveBeenCalled();
    expect(h.findFirst.mock.calls[0][0].where).toBeUndefined();
    expect(h.groupBy.mock.calls[0][0].where.createdAt).toEqual({ gt: T_SESSION });
    expect(cycle.sessionId).toBe('current');
    expect(cycle.sessionCreatedAt).toBeNull();
    expect(cycle.sessionDate).toBeNull();
    expect(cycle.dateType).toBeNull();
    expect(cycle.rows[0].countedBefore).toBe(46);
    expect(cycle.rows[0].counted).toBeNull();
    expect(cycle.rows[0].expected).toBeNull();
  });

  it('"current" sin ningún control suma toda la historia', async () => {
    const h = harness({
      previous: null,
      grouped: [{ productId: 'p1', type: 'entrada', reason: null, _sum: { quantity: 20 } }],
      catalog: [{ id: 'p1', name: 'Agua', unit: 'litros' }],
    });
    const cycle = await h.service.findStockCycle('current');

    expect(h.groupBy.mock.calls[0][0].where.createdAt).toBeUndefined();
    expect(cycle.rows[0].productName).toBe('Agua');
    expect(cycle.rows[0].unit).toBe('litros');
    expect(cycle.rows[0].entradas).toBe(20);
  });

  it('reparte cada tipo y motivo en su columna, dejando los ajustes signados', async () => {
    const h = harness({
      session: session('s1', T_SESSION, [entry('p1', 105, 105)]),
      previous: session('s0', T_PREV, [entry('p1', 100, 100)]),
      grouped: [
        { productId: 'p1', type: 'entrada', reason: null, _sum: { quantity: 10 } },
        { productId: 'p1', type: 'devolucion', reason: null, _sum: { quantity: 2 } },
        { productId: 'p1', type: 'venta_anulada', reason: null, _sum: { quantity: 5 } },
        { productId: 'p1', type: 'venta', reason: null, _sum: { quantity: -30 } },
        { productId: 'p1', type: 'consumo', reason: null, _sum: { quantity: -4 } },
        { productId: 'p1', type: 'ajuste_manual', reason: 'rotura', _sum: { quantity: -2 } },
        { productId: 'p1', type: 'ajuste_manual', reason: 'vencido', _sum: { quantity: -3 } },
        { productId: 'p1', type: 'ajuste_manual', reason: 'correccion', _sum: { quantity: -4 } },
        { productId: 'p1', type: 'ajuste_manual', reason: 'entrada_directa', _sum: { quantity: 6 } },
        { productId: 'p1', type: 'ajuste_manual', reason: null, _sum: { quantity: 1 } },
      ],
    });
    const cycle = await h.service.findStockCycle('s1');

    expect(cycle.rows[0]).toMatchObject({
      entradas: 10,
      devoluciones: 2,
      anulaciones: 5,
      ventas: 30,
      consumos: 4,
      roturas: 2,
      vencidos: 3,
      ajustes: 3,
      countedBefore: 100,
      expected: 105,
      counted: 105,
    });
    expect(cycle.hadSales).toBe(true);
    expect(cycle.days).toBe(7);
  });

  it('un ciclo sin ventas es un control de pedido, no merma', async () => {
    const h = harness({
      session: session('s1', T_SESSION, [entry('p1', 106, 104)]),
      previous: session('s0', T_PREV, [entry('p1', 46, 46)]),
      grouped: [{ productId: 'p1', type: 'entrada', reason: null, _sum: { quantity: 60 } }],
    });
    const cycle = await h.service.findStockCycle('s1');
    expect(cycle.hadSales).toBe(false);
  });

  it('muestra el producto con movimientos que el control no contó', async () => {
    const h = harness({
      session: session('s1', T_SESSION, [entry('p1', 50, 46)]),
      previous: session('s0', T_PREV, [entry('p1', 100, 100)]),
      grouped: [{ productId: 'p2', type: 'venta', reason: null, _sum: { quantity: -1.5 } }],
      catalog: [{ id: 'p2', name: 'Zanahoria', unit: 'kg' }],
    });
    const cycle = await h.service.findStockCycle('s1');

    expect(h.productFindMany.mock.calls[0][0].where).toEqual({ id: { in: ['p2'] } });
    const row = cycle.rows.find(r => r.productId === 'p2');
    expect(row).toMatchObject({
      productName: 'Zanahoria',
      unit: 'kg',
      countedBefore: null,
      counted: null,
      expected: null,
      ventas: 1.5,
    });
  });

  it('no consulta el catálogo cuando todos los productos vienen del control', async () => {
    const h = harness({
      session: session('s1', T_SESSION, [entry('p1', 50, 46)]),
      previous: session('s0', T_PREV, [entry('p1', 100, 100)]),
    });
    await h.service.findStockCycle('s1');
    expect(h.productFindMany).not.toHaveBeenCalled();
  });

  it('una sesión que no existe es 404 y no consulta movimientos', async () => {
    const h = harness({ session: null });
    await expect(h.service.findStockCycle('s-fantasma')).rejects.toThrow(NotFoundException);
    expect(h.groupBy).not.toHaveBeenCalled();
  });
});

function listHarness(sessions: FakeSession[]) {
  const findMany = vi.fn().mockResolvedValue(sessions);
  const groupBy = vi.fn().mockResolvedValue([]);
  const prisma = {
    sesionConteo: { findMany },
    movimientoStock: { groupBy },
    producto: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return { service: new StockService(prisma, {} as never), findMany, groupBy };
}

const T1 = new Date('2026-08-25T15:00:00.000Z');

describe('StockService.findStockCycles', () => {
  it('pide un control de más y empareja cada cierre con el anterior', async () => {
    const h = listHarness([
      session('s3', T_SESSION, [entry('p1', 41, 38)]),
      session('s2', T_PREV, [entry('p1', 106, 104)]),
      session('s1', T1, [entry('p1', 50, 46)]),
    ]);
    const cycles = await h.service.findStockCycles(2);

    expect(h.findMany.mock.calls[0][0]).toMatchObject({
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    expect(cycles.map(c => c.sessionId)).toEqual(['s3', 's2']);
    expect(cycles.map(c => c.previousSessionId)).toEqual(['s2', 's1']);
    expect(cycles.map(c => c.rows[0].countedBefore)).toEqual([104, 46]);
    // Una agregación por ciclo, ninguna de más.
    expect(h.groupBy).toHaveBeenCalledTimes(2);
  });

  it('el ciclo más viejo sale sin anterior sólo cuando la historia se terminó', async () => {
    const h = listHarness([
      session('s2', T_SESSION, [entry('p1', 41, 38)]),
      session('s1', T_PREV, [entry('p1', 50, 46)]),
    ]);
    const cycles = await h.service.findStockCycles(10);

    expect(cycles.map(c => c.previousSessionId)).toEqual(['s1', null]);
    expect(cycles[1].rows[0].countedBefore).toBeNull();
  });

  it('topea el limite en 60 y sin limite usa el default de la convención', async () => {
    const h = listHarness([]);

    await h.service.findStockCycles(5000);
    expect(h.findMany.mock.calls[0][0].take).toBe(61);
    await h.service.findStockCycles();
    expect(h.findMany.mock.calls[1][0].take).toBe(51);
    await h.service.findStockCycles(-3);
    expect(h.findMany.mock.calls[2][0].take).toBe(51);
    await h.service.findStockCycles(4);
    expect(h.findMany.mock.calls[3][0].take).toBe(5);
  });
});
