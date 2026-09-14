import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PublicOrdersService } from '../../src/public/public-orders.service';
import { SalesService } from '../../src/sales/sales.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';

const prisma = testPrisma();
const prismaAsService = prisma as unknown as PrismaService;
const movements = new StockMovementsService(prismaAsService);
const sales = new SalesService(prismaAsService, movements);
const sse = { broadcastKitchenEvent: () => {} } as never;

// Se reconstruye en cada test: PublicOrdersService cachea el id del operador
// "online" en memoria y resetTestDb() lo dejaría obsoleto entre casos.
let orders: PublicOrdersService;

async function seed(opts: { stock: number; visibleWeb: boolean }) {
  await prisma.usuario.create({
    data: { username: 'online', name: 'Online', role: 'Vendedor', password: 'x' },
  });
  const cuenta = await prisma.cuentaPublica.create({
    data: { email: 'socio@lch.test', passwordHash: 'h' },
  });
  const cat = await prisma.categoria.create({ data: { name: 'Insumos' } });
  const dep = await prisma.deposito.create({ data: { name: 'Principal', location: 'C' } });
  const cocina = await prisma.cocina.create({ data: { name: 'Parrilla' } });
  const catVenta = await prisma.categoriaVenta.create({ data: { name: 'Comidas' } });
  const pan = await prisma.producto.create({
    data: { name: 'Pan de hamburguesa', code: 'P-1', categoryId: cat.id },
  });
  await prisma.nivelStock.create({
    data: { productId: pan.id, warehouseId: dep.id, quantity: opts.stock },
  });
  const hamburguesa = await prisma.productoVenta.create({
    data: {
      name: 'Hamburguesa',
      categoriaVentaId: catVenta.id,
      kitchenId: cocina.id,
      price: 8000,
      active: true,
      visibleWeb: opts.visibleWeb,
    },
  });
  await prisma.itemReceta.create({
    data: { salesProductId: hamburguesa.id, stockProductId: pan.id, quantity: 1 },
  });
  return { cuenta, hamburguesa };
}

describe('PublicOrdersService.checkout (Postgres real)', () => {
  beforeEach(async () => {
    await resetTestDb();
    orders = new PublicOrdersService(prismaAsService, sales, sse);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rechaza con 400 un producto visibleWeb:false aunque esté activo', async () => {
    const { cuenta, hamburguesa } = await seed({ stock: 10, visibleWeb: false });
    await expect(
      orders.checkout(cuenta.id, { items: [{ salesProductId: hamburguesa.id, quantity: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea el PedidoPublico con status "listo" y genera OrdenCocina', async () => {
    const { cuenta, hamburguesa } = await seed({ stock: 10, visibleWeb: true });
    const order = await orders.checkout(cuenta.id, {
      items: [{ salesProductId: hamburguesa.id, quantity: 1 }],
    });
    expect(order.status).toBe('listo');
    const row = await prisma.pedidoPublico.findUnique({ where: { id: order.id } });
    expect(row?.status).toBe('listo');
    const cocinas = await prisma.ordenCocina.findMany({ where: { pedidoPublicoId: order.id } });
    expect(cocinas.length).toBeGreaterThan(0);
  });

  it('traduce el 409 de stock a español con el nombre de la línea', async () => {
    const { cuenta, hamburguesa } = await seed({ stock: 0, visibleWeb: true });
    await expect(
      orders.checkout(cuenta.id, { items: [{ salesProductId: hamburguesa.id, quantity: 1 }] }),
    ).rejects.toMatchObject({
      response: { message: 'No hay stock suficiente para: Hamburguesa' },
    });
  });
});
