import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { StockService } from '../../src/stock/stock.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { SettingsService } from '../../src/settings/settings.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';

const prisma = testPrisma();
const prismaAsService = prisma as unknown as PrismaService;

describe('bloqueo optimista (Producto, Configuracion) contra Postgres real', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('dos ediciones concurrentes con la misma versión: una gana, la otra recibe 409', async () => {
    const category = await prisma.categoria.create({ data: { name: 'Bebidas' } });
    const product = await prisma.producto.create({
      data: { name: 'Agua', code: 'AGUA-1', categoryId: category.id },
    });
    expect(product.version).toBe(0);

    const stock = new StockService(prismaAsService, new StockMovementsService(prismaAsService));

    const editorA = stock.updateProduct(product.id, { name: 'Agua Mineral', version: 0 });
    const editorB = stock.updateProduct(product.id, { name: 'Agua con Gas', version: 0 });

    const results = await Promise.allSettled([editorA, editorB]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /modificado por otra persona/,
    );

    const final = await prisma.producto.findUnique({ where: { id: product.id } });
    expect(final?.version).toBe(1);
    // El nombre final es el del editor que ganó — no un valor mezclado.
    expect(['Agua Mineral', 'Agua con Gas']).toContain(final?.name);
  });

  it('sin version en el DTO, el update no chequea (comportamiento previo)', async () => {
    const category = await prisma.categoria.create({ data: { name: 'Snacks' } });
    const product = await prisma.producto.create({
      data: { name: 'Papas', code: 'PAPAS-1', categoryId: category.id },
    });
    const stock = new StockService(prismaAsService, new StockMovementsService(prismaAsService));

    const updated = await stock.updateProduct(product.id, { name: 'Papas Fritas' });
    expect(updated.name).toBe('Papas Fritas');
    // version no se toca cuando no se manda — no es parte de este update.
    expect(updated.version).toBe(0);
  });

  it('Configuracion: version desactualizada en un registro existente da 409', async () => {
    const settings = new SettingsService(prismaAsService);
    await settings.upsertConfig({ key: 'tema', scope: 'admin', value: { color: 'azul' } });

    await settings.upsertConfig({ key: 'tema', scope: 'admin', value: { color: 'verde' }, version: 0 });

    await expect(
      settings.upsertConfig({ key: 'tema', scope: 'admin', value: { color: 'rojo' }, version: 0 }),
    ).rejects.toThrow(/modificado por otra persona/);
  });

  it('Configuracion: primera vez con version igual crea sin conflicto', async () => {
    const settings = new SettingsService(prismaAsService);
    const created = await settings.upsertConfig({
      key: 'nueva-clave',
      scope: 'admin',
      value: { x: 1 },
      version: 0,
    });
    expect(created).toMatchObject({ key: 'nueva-clave', scope: 'admin' });
  });
});
