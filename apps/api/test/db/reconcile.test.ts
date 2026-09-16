import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { testPrisma, resetTestDb, TEST_DATABASE_URL } from './helpers/db';

const prisma = testPrisma();

function runReconcile() {
  return spawnSync('node', ['scripts/reconcile-stock.mjs'], {
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

describe('reconciliación de datos derivados', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('no reporta deriva en una base vacía', () => {
    const result = runReconcile();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it('no reporta deriva cuando el nivel coincide con los movimientos', async () => {
    const categoria = await prisma.categoria.create({ data: { name: 'Bebidas' } });
    const deposito = await prisma.deposito.create({
      data: { name: 'Principal', location: 'Central' },
    });
    const producto = await prisma.producto.create({
      data: { name: 'Agua', code: 'BEB-001', categoryId: categoria.id },
    });
    await prisma.movimientoStock.create({
      data: { type: 'entrada', productId: producto.id, warehouseId: deposito.id, quantity: 10 },
    });
    await prisma.nivelStock.create({
      data: { productId: producto.id, warehouseId: deposito.id, quantity: 10 },
    });

    const result = runReconcile();
    expect(result.status, result.stdout).toBe(0);
  });

  it('reporta deriva cuando el nivel no coincide con los movimientos', async () => {
    const categoria = await prisma.categoria.create({ data: { name: 'Snacks' } });
    const deposito = await prisma.deposito.create({
      data: { name: 'Kiosco', location: 'Cancha' },
    });
    const producto = await prisma.producto.create({
      data: { name: 'Papas', code: 'SNK-001', categoryId: categoria.id },
    });
    await prisma.movimientoStock.create({
      data: { type: 'entrada', productId: producto.id, warehouseId: deposito.id, quantity: 10 },
    });
    await prisma.nivelStock.create({
      data: { productId: producto.id, warehouseId: deposito.id, quantity: 7 },
    });

    const result = runReconcile();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('SNK-001');
  });

  it('reporta deriva cuando hay movimientos sin nivel de stock materializado', async () => {
    const categoria = await prisma.categoria.create({ data: { name: 'Bebidas' } });
    const deposito = await prisma.deposito.create({
      data: { name: 'Depósito huérfano', location: 'Anexo' },
    });
    const producto = await prisma.producto.create({
      data: { name: 'Gaseosa', code: 'BEB-002', categoryId: categoria.id },
    });
    // Movimientos para (producto, depósito) sin fila correspondiente en
    // niveles_stock: el nivel nunca se materializó. Un LEFT JOIN que arranca
    // desde niveles_stock no ve este par; el reconcile tiene que reportarlo.
    await prisma.movimientoStock.create({
      data: { type: 'entrada', productId: producto.id, warehouseId: deposito.id, quantity: 10 },
    });

    const result = runReconcile();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('BEB-002');
  });

  it('reporta deriva cuando el total del ticket no coincide con sus líneas', async () => {
    const cocina = await prisma.cocina.create({ data: { name: 'Parrilla' } });
    const catVenta = await prisma.categoriaVenta.create({ data: { name: 'Comidas' } });
    const menu = await prisma.productoVenta.create({
      data: {
        name: 'Hamburguesa',
        categoriaVentaId: catVenta.id,
        kitchenId: cocina.id,
        price: 8500,
      },
    });
    const usuario = await prisma.usuario.create({
      data: { username: 'op', name: 'Op', role: 'Vendedor', password: 'x' },
    });
    const ticket = await prisma.ticketVenta.create({
      data: { number: 5000, total: 1, operatorId: usuario.id },
    });
    await prisma.itemTicketVenta.create({
      data: {
        ticketId: ticket.id,
        salesProductId: menu.id,
        name: 'Hamburguesa',
        unitPrice: 8500,
        quantity: 2,
      },
    });

    const result = runReconcile();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('5000');
  });

  it('reporta deriva cuando el total del pedido público no coincide con sus líneas', async () => {
    const cuenta = await prisma.cuentaPublica.create({
      data: { email: 'reconcile@lch.test', passwordHash: 'hash' },
    });
    const pedido = await prisma.pedidoPublico.create({
      data: { cuentaPublicaId: cuenta.id, total: 1 },
    });
    await prisma.itemPedidoPublico.create({
      data: { pedidoId: pedido.id, name: 'Agua', unitPrice: 1500, quantity: 2 },
    });

    const result = runReconcile();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(pedido.id);
  });
});
