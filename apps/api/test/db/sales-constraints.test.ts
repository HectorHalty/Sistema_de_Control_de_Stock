import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

async function seedMenu() {
  const cocina = await prisma.cocina.create({ data: { name: 'Parrilla', emoji: '🔥' } });
  const categoria = await prisma.categoriaVenta.create({ data: { name: 'Comidas' } });
  const producto = await prisma.productoVenta.create({
    data: {
      name: 'Hamburguesa',
      categoriaVentaId: categoria.id,
      kitchenId: cocina.id,
      price: 8500,
    },
  });
  return { cocina, categoria, producto };
}

describe('restricciones de ventas', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rechaza un producto de venta con una categoría que no existe', async () => {
    const cocina = await prisma.cocina.create({ data: { name: 'Cocina' } });
    await expect(
      prisma.productoVenta.create({
        data: {
          name: 'X',
          categoriaVentaId: '00000000-0000-4000-8000-000000000099',
          kitchenId: cocina.id,
          price: 100,
        },
      }),
    ).rejects.toThrow();
  });

  it('impide borrar una categoría de venta que tiene productos', async () => {
    const { categoria } = await seedMenu();
    await expect(
      prisma.categoriaVenta.delete({ where: { id: categoria.id } }),
    ).rejects.toThrow();
  });

  it('rechaza un precio negativo en el menú', async () => {
    const cocina = await prisma.cocina.create({ data: { name: 'Barra' } });
    const categoria = await prisma.categoriaVenta.create({ data: { name: 'Bebidas' } });
    await expect(
      prisma.productoVenta.create({
        data: { name: 'Y', categoriaVentaId: categoria.id, kitchenId: cocina.id, price: -1 },
      }),
    ).rejects.toThrow();
  });

  it('rechaza un estado de ticket inventado', async () => {
    const usuario = await prisma.usuario.create({
      data: { username: 'op', name: 'Op', role: 'Vendedor', password: 'x' },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "tickets_venta" ("id", "number", "status", "total", "operatorId")
         VALUES (gen_random_uuid()::text, 1, 'reembolsado', 100, $1)`,
        usuario.id,
      ),
    ).rejects.toThrow();
  });

  it('rechaza un total de ticket negativo', async () => {
    const usuario = await prisma.usuario.create({
      data: { username: 'op2', name: 'Op', role: 'Vendedor', password: 'x' },
    });
    await expect(
      prisma.ticketVenta.create({
        data: { number: 2, total: -5, operatorId: usuario.id },
      }),
    ).rejects.toThrow();
  });

  it('rechaza una cantidad de línea en cero', async () => {
    const { producto } = await seedMenu();
    const usuario = await prisma.usuario.create({
      data: { username: 'op3', name: 'Op', role: 'Vendedor', password: 'x' },
    });
    const ticket = await prisma.ticketVenta.create({
      data: { number: 3, total: 0, operatorId: usuario.id },
    });
    await expect(
      prisma.itemTicketVenta.create({
        data: {
          ticketId: ticket.id,
          salesProductId: producto.id,
          name: 'Hamburguesa',
          unitPrice: 8500,
          quantity: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it('rechaza una mesa apuntando a un ticket que no existe', async () => {
    await expect(
      prisma.mesaVenta.create({
        data: {
          name: 'Mesa 1',
          status: 'ocupada',
          currentOrderId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    ).rejects.toThrow();
  });

  it('rechaza un estado de mesa inventado', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "mesas_venta" ("id", "name", "status", "updatedAt")
         VALUES (gen_random_uuid()::text, 'Mesa 2', 'sucia', now())`,
      ),
    ).rejects.toThrow();
  });

  it('rechaza dos impresoras con el mismo nombre', async () => {
    await prisma.impresora.create({ data: { name: 'Barra', type: 'termica', ip: '10.0.0.1' } });
    await expect(
      prisma.impresora.create({ data: { name: 'Barra', type: 'termica', ip: '10.0.0.2' } }),
    ).rejects.toThrow();
  });

  it('rechaza una cantidad de componente de combo en cero', async () => {
    const { cocina, categoria, producto } = await seedMenu();
    const promo = await prisma.productoVenta.create({
      data: {
        name: 'Combo Hamburguesa',
        categoriaVentaId: categoria.id,
        kitchenId: cocina.id,
        price: 9500,
        kind: 'promo',
      },
    });
    await expect(
      prisma.itemComboVenta.create({
        data: { promoProductId: promo.id, componentProductId: producto.id, quantity: 0 },
      }),
    ).rejects.toThrow();
  });
});
