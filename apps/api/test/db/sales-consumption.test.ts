import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SalesService } from '../../src/sales/sales.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';

const prisma = testPrisma();
const prismaAsService = prisma as unknown as PrismaService;

/**
 * Consumo interno (docs/superpowers/plans/2026-09-08-consumo-como-venta.md):
 * mismo circuito que un checkout (receta, descuento de stock, bloqueo por
 * insuficiencia) pero total $0, `origen: 'consumo'` y el movimiento de stock
 * tipado `consumo` en vez de `venta`. Reemplaza al viejo
 * `StockService.createEmployeeConsumption` (retirado — consumía un producto
 * de stock directo, sin receta).
 */
describe('consumo interno vía SalesService.registerConsumption (Postgres real)', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedMenu() {
    const usuario = await prisma.usuario.create({
      data: { username: 'op-consumo', name: 'Operador', role: 'Vendedor', password: 'x' },
    });
    const categoria = await prisma.categoria.create({ data: { name: 'Insumos' } });
    const deposito = await prisma.deposito.create({ data: { name: 'Principal', location: 'Central' } });
    const insumo = await prisma.producto.create({
      data: { name: 'Pan de hamburguesa', code: 'INS-001', categoryId: categoria.id },
    });
    await prisma.nivelStock.create({
      data: { productId: insumo.id, warehouseId: deposito.id, quantity: 10 },
    });
    const cocina = await prisma.cocina.create({ data: { name: 'Parrilla' } });
    const catVenta = await prisma.categoriaVenta.create({ data: { name: 'Comidas' } });
    const menu = await prisma.productoVenta.create({
      data: { name: 'Hamburguesa', categoriaVentaId: catVenta.id, kitchenId: cocina.id, price: 8500 },
    });
    await prisma.itemReceta.create({
      data: { salesProductId: menu.id, stockProductId: insumo.id, quantity: 1 },
    });
    return { insumo, deposito, menu, usuario };
  }

  it('descuenta stock por receta, ticket en $0, origen "consumo"', async () => {
    const { insumo, deposito, menu, usuario } = await seedMenu();
    const sales = new SalesService(prismaAsService, new StockMovementsService(prismaAsService));

    const result = await sales.registerConsumption({
      items: [{ salesProductId: menu.id, quantity: 2 }],
      operatorId: usuario.id,
    });

    expect(result.ok).toBe(true);
    expect(Number(result.ticket.total)).toBe(0);
    expect(result.ticket.origen).toBe('consumo');
    expect(Number(result.ticket.items[0].unitPrice)).toBe(0);

    const nivel = await prisma.nivelStock.findUnique({
      where: { productId_warehouseId: { productId: insumo.id, warehouseId: deposito.id } },
    });
    expect(Number(nivel?.quantity)).toBe(8);

    const movimiento = await prisma.movimientoStock.findFirst({ where: { reference: result.ticket.id } });
    expect(movimiento?.type).toBe('consumo');
    expect(Number(movimiento?.quantity)).toBe(-2);
  });

  it('bloquea el consumo si no hay receta suficiente en stock (mismo criterio que un checkout)', async () => {
    const { menu, usuario } = await seedMenu();
    const sales = new SalesService(prismaAsService, new StockMovementsService(prismaAsService));

    await expect(
      sales.registerConsumption({ items: [{ salesProductId: menu.id, quantity: 99 }], operatorId: usuario.id }),
    ).rejects.toThrow(/Insufficient stock/);
  });

  it('no aparece en el total de ventas: un checkout real y un consumo del mismo producto se distinguen por origen', async () => {
    const { insumo, deposito, menu, usuario } = await seedMenu();
    // Stock extra para no chocar con el límite del checkout de $venta.
    await prisma.nivelStock.update({
      where: { productId_warehouseId: { productId: insumo.id, warehouseId: deposito.id } },
      data: { quantity: 20 },
    });
    const sales = new SalesService(prismaAsService, new StockMovementsService(prismaAsService));

    const venta = await sales.checkout({ items: [{ salesProductId: menu.id, quantity: 1 }], operatorId: usuario.id });
    const consumo = await sales.registerConsumption({ items: [{ salesProductId: menu.id, quantity: 1 }], operatorId: usuario.id });

    expect(venta.ticket.origen).toBe('pos');
    expect(Number(venta.ticket.total)).toBe(8500);
    expect(consumo.ticket.origen).toBe('consumo');
    expect(Number(consumo.ticket.total)).toBe(0);

    const tickets = await prisma.ticketVenta.findMany({ where: { origen: 'consumo' } });
    expect(tickets).toHaveLength(1);
    expect(tickets[0].id).toBe(consumo.ticket.id);
  });
});
