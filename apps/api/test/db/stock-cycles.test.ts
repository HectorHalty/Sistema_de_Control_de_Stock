import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { StockService } from '../../src/stock/stock.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';
import type { StockCycleRowDto } from '../../src/stock/dto';

const prisma = testPrisma();
const prismaAsService = prisma as unknown as PrismaService;

function service(): StockService {
  return new StockService(prismaAsService, new StockMovementsService(prismaAsService));
}

/** Instante fijo: el ciclo se define por `createdAt`, no por el día de venta. */
function at(iso: string): Date {
  return new Date(iso);
}

const T0 = at('2026-09-01T15:00:00.000Z');
const TA = at('2026-09-08T15:00:00.000Z');
const TB = at('2026-09-10T15:00:00.000Z');
const TC = at('2026-09-17T15:00:00.000Z');

async function seedCatalog() {
  const categoria = await prisma.categoria.create({ data: { name: 'Insumos' } });
  const deposito = await prisma.deposito.create({
    data: { name: 'Principal', location: 'Central' },
  });
  const producto = await prisma.producto.create({
    data: { name: 'Pan de hamburguesa', code: 'INS-001', categoryId: categoria.id, unit: 'unidades' },
  });
  return { categoria, deposito, producto };
}

async function countSession(input: {
  createdAt: Date;
  date: string;
  dateType?: string;
  productId: string;
  productName?: string;
  expected: number;
  counted: number;
}) {
  return prisma.sesionConteo.create({
    data: {
      createdAt: input.createdAt,
      date: input.date,
      dateType: input.dateType ?? 'regular',
      entries: {
        create: [{
          productId: input.productId,
          productName: input.productName ?? 'Pan de hamburguesa',
          unit: 'unidades',
          expected: input.expected,
          counted: input.counted,
        }],
      },
    },
  });
}

async function movement(input: {
  createdAt: Date;
  type: 'venta' | 'devolucion' | 'venta_anulada' | 'ajuste_manual' | 'consumo' | 'entrada' | 'diferencia_conteo' | 'pasaje';
  productId: string;
  warehouseId: string;
  quantity: number;
  reason?: 'rotura' | 'vencido' | 'correccion' | 'entrada_directa';
}) {
  return prisma.movimientoStock.create({
    data: {
      createdAt: input.createdAt,
      type: input.type,
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      reason: input.reason ?? null,
    },
  });
}

/** Minutos después de un instante, para ubicar movimientos dentro de una ventana. */
function plusMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

/**
 * Los tres ciclos del oráculo sobre el mismo producto. El del medio (B) es un
 * control de pedido recibido: entró mercadería y no se vendió nada.
 *
 * El `diferencia_conteo` de cada control se escribe JUSTO ANTES de su
 * `createdAt` porque así lo hace el admin: llama a count-apply y después graba
 * la sesión. Queda dentro de su propia ventana y el servicio tiene que
 * excluirlo, o la diferencia se contaría dos veces.
 */
async function seedOracle() {
  const { deposito, producto } = await seedCatalog();
  const p = producto.id;
  const w = deposito.id;

  const s0 = await countSession({
    createdAt: T0, date: '2026-09-01', productId: p, expected: 100, counted: 100,
  });

  await movement({ createdAt: plusMinutes(T0, 60), type: 'venta', productId: p, warehouseId: w, quantity: -50 });
  await movement({ createdAt: plusMinutes(TA, -1), type: 'diferencia_conteo', productId: p, warehouseId: w, quantity: -4 });
  const sa = await countSession({
    createdAt: TA, date: '2026-09-08', productId: p, expected: 50, counted: 46,
  });

  await movement({ createdAt: plusMinutes(TA, 60), type: 'entrada', productId: p, warehouseId: w, quantity: 60 });
  await movement({ createdAt: plusMinutes(TB, -1), type: 'diferencia_conteo', productId: p, warehouseId: w, quantity: -2 });
  const sb = await countSession({
    createdAt: TB, date: '2026-09-10', dateType: 'verificacion', productId: p, expected: 106, counted: 104,
  });

  await movement({ createdAt: plusMinutes(TB, 60), type: 'venta', productId: p, warehouseId: w, quantity: -60 });
  await movement({ createdAt: plusMinutes(TB, 120), type: 'consumo', productId: p, warehouseId: w, quantity: -2 });
  await movement({ createdAt: plusMinutes(TB, 180), type: 'ajuste_manual', productId: p, warehouseId: w, quantity: -1, reason: 'rotura' });
  await movement({ createdAt: plusMinutes(TC, -1), type: 'diferencia_conteo', productId: p, warehouseId: w, quantity: -3 });
  const sc = await countSession({
    createdAt: TC, date: '2026-09-17', productId: p, expected: 41, counted: 38,
  });

  return { producto, deposito, s0, sa, sb, sc };
}

function sums(row: StockCycleRowDto) {
  return {
    entradas: row.entradas,
    devoluciones: row.devoluciones,
    anulaciones: row.anulaciones,
    ventas: row.ventas,
    consumos: row.consumos,
    roturas: row.roturas,
    vencidos: row.vencidos,
    ajustes: row.ajustes,
  };
}

const NO_SUMS = {
  entradas: 0, devoluciones: 0, anulaciones: 0, ventas: 0,
  consumos: 0, roturas: 0, vencidos: 0, ajustes: 0,
};

describe('ciclos de stock (Postgres real)', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('devuelve el oráculo de los tres ciclos, con el del medio sin ventas', async () => {
    const { sa, sb, sc, s0 } = await seedOracle();
    const stock = service();

    const a = await stock.findStockCycle(sa.id);
    expect(a.previousSessionId).toBe(s0.id);
    expect(a.days).toBe(7);
    expect(a.hadSales).toBe(true);
    expect(a.dateType).toBe('regular');
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0].countedBefore).toBe(100);
    expect(a.rows[0].expected).toBe(50);
    expect(a.rows[0].counted).toBe(46);
    expect(sums(a.rows[0])).toEqual({ ...NO_SUMS, ventas: 50 });

    const b = await stock.findStockCycle(sb.id);
    expect(b.previousSessionId).toBe(sa.id);
    expect(b.days).toBe(2);
    expect(b.hadSales).toBe(false);
    expect(b.dateType).toBe('verificacion');
    expect(b.rows[0].countedBefore).toBe(46);
    expect(b.rows[0].expected).toBe(106);
    expect(b.rows[0].counted).toBe(104);
    expect(sums(b.rows[0])).toEqual({ ...NO_SUMS, entradas: 60 });

    const c = await stock.findStockCycle(sc.id);
    expect(c.previousSessionId).toBe(sb.id);
    expect(c.days).toBe(7);
    expect(c.hadSales).toBe(true);
    expect(c.rows[0].countedBefore).toBe(104);
    expect(c.rows[0].expected).toBe(41);
    expect(c.rows[0].counted).toBe(38);
    expect(sums(c.rows[0])).toEqual({ ...NO_SUMS, ventas: 60, consumos: 2, roturas: 1 });
  });

  it('cierra la identidad del ciclo en los tres: consumoReal = salidas + diferencia', async () => {
    const { sa, sb, sc } = await seedOracle();
    const stock = service();

    for (const [sessionId, esperado] of [
      [sa.id, { salidas: 50, diferencia: 4, consumoReal: 54 }],
      [sb.id, { salidas: 0, diferencia: 2, consumoReal: 2 }],
      [sc.id, { salidas: 63, diferencia: 3, consumoReal: 66 }],
    ] as const) {
      const cycle = await stock.findStockCycle(sessionId);
      const r = cycle.rows[0];
      const adiciones = r.entradas + r.devoluciones + r.anulaciones + Math.max(r.ajustes, 0);
      const salidas = r.ventas + r.consumos + r.roturas + r.vencidos + Math.max(-r.ajustes, 0);
      const countedBefore = r.countedBefore as number;
      const counted = r.counted as number;
      const diferencia = (r.expected as number) - counted;

      expect(salidas).toBe(esperado.salidas);
      expect(diferencia).toBe(esperado.diferencia);
      expect(countedBefore + adiciones - counted).toBe(esperado.consumoReal);
      expect(countedBefore + adiciones - salidas).toBe(r.expected);
    }
  });

  it('suma un ciclo de más de 500 movimientos completo (el límite de /stock/movements no aplica)', async () => {
    const { deposito, producto } = await seedCatalog();
    const s0 = await countSession({
      createdAt: T0, date: '2026-09-01', productId: producto.id, expected: 700, counted: 700,
    });
    await prisma.movimientoStock.createMany({
      data: Array.from({ length: 600 }, (_, i) => ({
        createdAt: plusMinutes(T0, i + 1),
        type: 'venta' as const,
        productId: producto.id,
        warehouseId: deposito.id,
        quantity: -1,
        reference: `TKT-${i}`,
      })),
    });
    const sa = await countSession({
      createdAt: TA, date: '2026-09-08', productId: producto.id, expected: 100, counted: 98,
    });

    const total = await prisma.movimientoStock.count({
      where: { createdAt: { gt: s0.createdAt, lte: sa.createdAt } },
    });
    expect(total).toBe(600);

    const cycle = await service().findStockCycle(sa.id);
    expect(cycle.rows[0].ventas).toBe(600);
    expect(cycle.hadSales).toBe(true);
  });

  it('un diferencia_conteo dentro de la ventana no mueve ninguna suma', async () => {
    const { deposito, producto } = await seedCatalog();
    await countSession({
      createdAt: T0, date: '2026-09-01', productId: producto.id, expected: 100, counted: 100,
    });
    await movement({ createdAt: plusMinutes(T0, 60), type: 'venta', productId: producto.id, warehouseId: deposito.id, quantity: -50 });
    const sa = await countSession({
      createdAt: TA, date: '2026-09-08', productId: producto.id, expected: 50, counted: 46,
    });
    const stock = service();
    const antes = await stock.findStockCycle(sa.id);

    // El admin aplica el conteo ANTES de grabar la sesión: la corrección queda
    // dentro de la propia ventana del control que la generó.
    await movement({
      createdAt: plusMinutes(TA, -1), type: 'diferencia_conteo',
      productId: producto.id, warehouseId: deposito.id, quantity: -4,
    });

    const despues = await stock.findStockCycle(sa.id);
    expect(sums(despues.rows[0])).toEqual(sums(antes.rows[0]));
    expect(sums(despues.rows[0])).toEqual({ ...NO_SUMS, ventas: 50 });
  });

  it('las dos patas de un pasaje dentro de la ventana no mueven ninguna suma', async () => {
    const { deposito, producto } = await seedCatalog();
    const otro = await prisma.deposito.create({ data: { name: 'Kiosco', location: 'Cancha' } });
    await countSession({
      createdAt: T0, date: '2026-09-01', productId: producto.id, expected: 100, counted: 100,
    });
    await movement({ createdAt: plusMinutes(T0, 60), type: 'venta', productId: producto.id, warehouseId: deposito.id, quantity: -50 });
    await movement({ createdAt: plusMinutes(T0, 90), type: 'pasaje', productId: producto.id, warehouseId: deposito.id, quantity: -20 });
    await movement({ createdAt: plusMinutes(T0, 90), type: 'pasaje', productId: producto.id, warehouseId: otro.id, quantity: 20 });
    const sa = await countSession({
      createdAt: TA, date: '2026-09-08', productId: producto.id, expected: 50, counted: 46,
    });

    const cycle = await service().findStockCycle(sa.id);
    expect(sums(cycle.rows[0])).toEqual({ ...NO_SUMS, ventas: 50 });
  });

  it('deja ver un producto con movimientos en la ventana que el control no contó', async () => {
    const { deposito, producto, categoria } = await seedCatalog();
    const sinContar = await prisma.producto.create({
      data: { name: 'Zanahoria', code: 'INS-002', categoryId: categoria.id, unit: 'kg' },
    });
    await countSession({
      createdAt: T0, date: '2026-09-01', productId: producto.id, expected: 100, counted: 100,
    });
    await movement({ createdAt: plusMinutes(T0, 60), type: 'venta', productId: sinContar.id, warehouseId: deposito.id, quantity: -1.5 });
    const sa = await countSession({
      createdAt: TA, date: '2026-09-08', productId: producto.id, expected: 100, counted: 100,
    });

    const cycle = await service().findStockCycle(sa.id);
    const row = cycle.rows.find(r => r.productId === sinContar.id);
    expect(row).toBeDefined();
    expect(row?.productName).toBe('Zanahoria');
    expect(row?.unit).toBe('kg');
    expect(row?.counted).toBeNull();
    expect(row?.expected).toBeNull();
    expect(row?.countedBefore).toBeNull();
    expect(row?.ventas).toBe(1.5);
  });

  it('el primer control de la historia no tiene anterior y sale sin contado anterior', async () => {
    const { deposito, producto } = await seedCatalog();
    await movement({ createdAt: at('2026-08-20T10:00:00.000Z'), type: 'venta', productId: producto.id, warehouseId: deposito.id, quantity: -7 });
    const s0 = await countSession({
      createdAt: T0, date: '2026-09-01', productId: producto.id, expected: 100, counted: 93,
    });

    const cycle = await service().findStockCycle(s0.id);
    expect(cycle.previousSessionId).toBeNull();
    expect(cycle.previousCreatedAt).toBeNull();
    expect(cycle.days).toBe(1);
    expect(cycle.rows[0].countedBefore).toBeNull();
    // Ventana abierta al inicio: el movimiento de agosto entra.
    expect(cycle.rows[0].ventas).toBe(7);
  });

  it('"current" es el ciclo abierto: desde el último control y sin nada contado', async () => {
    const { deposito, producto, sc } = await seedOracle();
    await movement({
      createdAt: plusMinutes(TC, 60), type: 'venta',
      productId: producto.id, warehouseId: deposito.id, quantity: -5,
    });

    const cycle = await service().findStockCycle('current');
    expect(cycle.sessionId).toBe('current');
    expect(cycle.sessionCreatedAt).toBeNull();
    expect(cycle.sessionDate).toBeNull();
    expect(cycle.dateType).toBeNull();
    expect(cycle.previousSessionId).toBe(sc.id);
    expect(cycle.hadSales).toBe(true);
    expect(cycle.rows).toHaveLength(1);
    expect(cycle.rows[0].countedBefore).toBe(38);
    expect(cycle.rows[0].counted).toBeNull();
    expect(cycle.rows[0].expected).toBeNull();
    expect(cycle.rows[0].ventas).toBe(5);
  });

  it('"current" sin ningún control todavía suma toda la historia', async () => {
    const { deposito, producto } = await seedCatalog();
    await movement({ createdAt: T0, type: 'entrada', productId: producto.id, warehouseId: deposito.id, quantity: 20 });
    await movement({ createdAt: plusMinutes(T0, 60), type: 'venta', productId: producto.id, warehouseId: deposito.id, quantity: -3 });

    const cycle = await service().findStockCycle('current');
    expect(cycle.previousSessionId).toBeNull();
    expect(cycle.rows[0].entradas).toBe(20);
    expect(cycle.rows[0].ventas).toBe(3);
    expect(cycle.rows[0].countedBefore).toBeNull();
  });

  it('separa roturas, vencidos y el resto de los ajustes', async () => {
    const { deposito, producto } = await seedCatalog();
    await countSession({
      createdAt: T0, date: '2026-09-01', productId: producto.id, expected: 100, counted: 100,
    });
    const w = deposito.id;
    const p = producto.id;
    await movement({ createdAt: plusMinutes(T0, 10), type: 'ajuste_manual', productId: p, warehouseId: w, quantity: -2, reason: 'rotura' });
    await movement({ createdAt: plusMinutes(T0, 20), type: 'ajuste_manual', productId: p, warehouseId: w, quantity: -3, reason: 'vencido' });
    await movement({ createdAt: plusMinutes(T0, 30), type: 'ajuste_manual', productId: p, warehouseId: w, quantity: -4, reason: 'correccion' });
    await movement({ createdAt: plusMinutes(T0, 40), type: 'ajuste_manual', productId: p, warehouseId: w, quantity: 6, reason: 'entrada_directa' });
    await movement({ createdAt: plusMinutes(T0, 50), type: 'ajuste_manual', productId: p, warehouseId: w, quantity: 1 });
    await movement({ createdAt: plusMinutes(T0, 60), type: 'devolucion', productId: p, warehouseId: w, quantity: 2 });
    await movement({ createdAt: plusMinutes(T0, 70), type: 'venta_anulada', productId: p, warehouseId: w, quantity: 5 });
    const sa = await countSession({
      createdAt: TA, date: '2026-09-08', productId: p, expected: 105, counted: 105,
    });

    const cycle = await service().findStockCycle(sa.id);
    expect(sums(cycle.rows[0])).toEqual({
      ...NO_SUMS,
      devoluciones: 2,
      anulaciones: 5,
      roturas: 2,
      vencidos: 3,
      ajustes: 3,
    });
    expect(cycle.hadSales).toBe(false);
  });

  it('una sesión que no existe es 404', async () => {
    await expect(
      service().findStockCycle('00000000-0000-4000-8000-000000000099'),
    ).rejects.toThrow(NotFoundException);
  });

  it('la lista devuelve un ciclo por par consecutivo de controles, del más nuevo al más viejo', async () => {
    const { s0, sa, sb, sc } = await seedOracle();

    const cycles = await service().findStockCycles();

    expect(cycles.map(c => c.sessionId)).toEqual([sc.id, sb.id, sa.id, s0.id]);
    expect(cycles.map(c => c.previousSessionId)).toEqual([sb.id, sa.id, s0.id, null]);
    expect(cycles.map(c => c.hadSales)).toEqual([true, false, true, false]);
    expect(cycles.map(c => c.dateType)).toEqual(['regular', 'verificacion', 'regular', 'regular']);
    // El envoltorio y las filas son los mismos que los del ciclo suelto.
    expect(cycles[0]).toEqual(await service().findStockCycle(sc.id));
  });

  it('el ciclo más viejo de la lista sólo sale sin anterior si es el primer control de la historia', async () => {
    const { s0, sa, sb, sc } = await seedOracle();
    const stock = service();

    // Con la ventana recortada, el más viejo de la lista sigue teniendo su
    // anterior: el control existe aunque el ciclo no entre.
    const recortada = await stock.findStockCycles(2);
    expect(recortada.map(c => c.sessionId)).toEqual([sc.id, sb.id]);
    expect(recortada[1].previousSessionId).toBe(sa.id);
    expect(recortada[1].rows[0].countedBefore).toBe(46);

    // Con la historia completa, el primer control es el único sin anterior.
    const completa = await stock.findStockCycles(4);
    expect(completa[3].sessionId).toBe(s0.id);
    expect(completa[3].previousSessionId).toBeNull();
    expect(completa[3].rows[0].countedBefore).toBeNull();
  });

  it('respeta el limite pedido y lo topea en 60', async () => {
    const { producto } = await seedCatalog();
    for (let i = 0; i < 4; i += 1) {
      await countSession({
        createdAt: plusMinutes(T0, i * 60),
        date: '2026-09-01',
        productId: producto.id,
        expected: 100 - i,
        counted: 100 - i,
      });
    }
    const stock = service();

    expect(await stock.findStockCycles(2)).toHaveLength(2);
    // Un limite absurdo se topea; con 4 controles la lista se queda en 4.
    expect(await stock.findStockCycles(5000)).toHaveLength(4);

    const conMuchos = await prisma.sesionConteo.createMany({
      data: Array.from({ length: 70 }, (_, i) => ({
        createdAt: plusMinutes(TA, i),
        date: '2026-09-08',
        dateType: 'regular',
      })),
    });
    expect(conMuchos.count).toBe(70);
    expect(await stock.findStockCycles(5000)).toHaveLength(60);
  });
});
