import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { StockService } from '../../src/stock/stock.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';

const prisma = testPrisma();
const prismaAsService = prisma as unknown as PrismaService;

describe('paginación por cursor (Producto) contra Postgres real', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedProducts(n: number, category: { id: string }) {
    for (let i = 0; i < n; i++) {
      // Nombres con padding para que el orderBy alfabético sea determinístico.
      await prisma.producto.create({
        data: { name: `Producto ${String(i).padStart(3, '0')}`, code: `COD-${i}`, categoryId: category.id },
      });
    }
  }

  it('sin cursor/limit devuelve el array completo (compatibilidad)', async () => {
    const category = await prisma.categoria.create({ data: { name: 'Cat' } });
    await seedProducts(5, category);
    const stock = new StockService(prismaAsService, new StockMovementsService(prismaAsService));

    const all = await stock.findAllProducts();
    expect(Array.isArray(all)).toBe(true);
    expect(all).toHaveLength(5);
  });

  it('con limit sin cursor devuelve la primera página y un nextCursor', async () => {
    const category = await prisma.categoria.create({ data: { name: 'Cat' } });
    await seedProducts(5, category);
    const stock = new StockService(prismaAsService, new StockMovementsService(prismaAsService));

    const page = await stock.findAllProducts(undefined, undefined, 2);
    expect(page.items).toHaveLength(2);
    expect(page.items.map(p => p.name)).toEqual(['Producto 000', 'Producto 001']);
    expect(page.nextCursor).not.toBeNull();
  });

  it('recorrer con nextCursor trae todas las filas sin repetir ni saltear', async () => {
    const category = await prisma.categoria.create({ data: { name: 'Cat' } });
    await seedProducts(7, category);
    const stock = new StockService(prismaAsService, new StockMovementsService(prismaAsService));

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = await stock.findAllProducts(undefined, cursor, 3);
      seen.push(...page.items.map(p => p.name));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    expect(seen).toEqual([
      'Producto 000', 'Producto 001', 'Producto 002',
      'Producto 003', 'Producto 004', 'Producto 005',
      'Producto 006',
    ]);
  });

  it('la última página no trae nextCursor', async () => {
    const category = await prisma.categoria.create({ data: { name: 'Cat' } });
    await seedProducts(4, category);
    const stock = new StockService(prismaAsService, new StockMovementsService(prismaAsService));

    const first = await stock.findAllProducts(undefined, undefined, 3);
    expect(first.nextCursor).not.toBeNull();
    const second = await stock.findAllProducts(undefined, first.nextCursor!, 3);
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });
});
