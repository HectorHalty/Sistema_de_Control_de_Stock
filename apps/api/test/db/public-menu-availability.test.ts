import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PublicService } from '../../src/public/public.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';
import type { ReglamentoEngineService } from '../../src/reglamento/reglamento-engine.service';

const prisma = testPrisma();
const service = new PublicService(
  prisma as unknown as PrismaService,
  {} as unknown as ReglamentoEngineService,
);

async function seedMenu() {
  const cat = await prisma.categoria.create({ data: { name: 'Insumos' } });
  const dep = await prisma.deposito.create({ data: { name: 'Principal', location: 'C' } });
  const cocina = await prisma.cocina.create({ data: { name: 'Parrilla' } });
  const catVenta = await prisma.categoriaVenta.create({ data: { name: 'Comidas' } });
  const pan = await prisma.producto.create({
    data: { name: 'Pan', code: 'P-1', categoryId: cat.id },
  });
  const medallon = await prisma.producto.create({
    data: { name: 'Medallón', code: 'P-2', categoryId: cat.id },
  });
  return { dep, cocina, catVenta, pan, medallon };
}

describe('PublicService.listMenu — disponibilidad por stock (Postgres real)', () => {
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('omite un simple cuya receta pide más stock del disponible', async () => {
    const { dep, cocina, catVenta, pan } = await seedMenu();
    await prisma.nivelStock.create({
      data: { productId: pan.id, warehouseId: dep.id, quantity: 0 },
    });
    const hamburguesa = await prisma.productoVenta.create({
      data: {
        name: 'Hamburguesa',
        categoriaVentaId: catVenta.id,
        kitchenId: cocina.id,
        price: 8000,
        active: true,
        visibleWeb: true,
      },
    });
    await prisma.itemReceta.create({
      data: { salesProductId: hamburguesa.id, stockProductId: pan.id, quantity: 1 },
    });

    const menu = await service.listMenu();
    expect(menu.items.find((i) => i.id === hamburguesa.id)).toBeUndefined();
  });

  it('incluye el mismo ítem cuando hay stock', async () => {
    const { dep, cocina, catVenta, pan } = await seedMenu();
    await prisma.nivelStock.create({
      data: { productId: pan.id, warehouseId: dep.id, quantity: 10 },
    });
    const hamburguesa = await prisma.productoVenta.create({
      data: {
        name: 'Hamburguesa',
        categoriaVentaId: catVenta.id,
        kitchenId: cocina.id,
        price: 8000,
        active: true,
        visibleWeb: true,
      },
    });
    await prisma.itemReceta.create({
      data: { salesProductId: hamburguesa.id, stockProductId: pan.id, quantity: 1 },
    });

    const menu = await service.listMenu();
    expect(menu.items.find((i) => i.id === hamburguesa.id)).toBeDefined();
  });

  it('omite una promo si un componente está agotado', async () => {
    const { dep, cocina, catVenta, pan, medallon } = await seedMenu();
    await prisma.nivelStock.create({
      data: { productId: pan.id, warehouseId: dep.id, quantity: 10 },
    });
    await prisma.nivelStock.create({
      data: { productId: medallon.id, warehouseId: dep.id, quantity: 0 },
    });
    const hamburguesa = await prisma.productoVenta.create({
      data: {
        name: 'Hamburguesa',
        categoriaVentaId: catVenta.id,
        kitchenId: cocina.id,
        price: 8000,
        active: true,
        visibleWeb: true,
        kind: 'simple',
      },
    });
    await prisma.itemReceta.create({
      data: { salesProductId: hamburguesa.id, stockProductId: pan.id, quantity: 1 },
    });
    await prisma.itemReceta.create({
      data: { salesProductId: hamburguesa.id, stockProductId: medallon.id, quantity: 1 },
    });
    const combo = await prisma.productoVenta.create({
      data: {
        name: 'Combo',
        categoriaVentaId: catVenta.id,
        kitchenId: cocina.id,
        price: 12000,
        active: true,
        visibleWeb: true,
        kind: 'promo',
      },
    });
    await prisma.itemComboVenta.create({
      data: { promoProductId: combo.id, componentProductId: hamburguesa.id, quantity: 1 },
    });

    const menu = await service.listMenu();
    expect(menu.items.find((i) => i.id === combo.id)).toBeUndefined();
    expect(menu.items.find((i) => i.id === hamburguesa.id)).toBeUndefined();
  });
});
