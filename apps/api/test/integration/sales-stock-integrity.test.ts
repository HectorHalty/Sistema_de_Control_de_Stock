import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { SalesService } from '../../src/sales/sales.service';
import { StockService } from '../../src/stock/stock.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import {
  createEmptyStockState,
  createPrismaMock,
  seedBasicCatalog,
  type StockTestState,
} from '../helpers/stock-test-store';

function qty(state: StockTestState, productId: string, warehouseId: string) {
  return state.stockLevels.find(s => s.productId === productId && s.warehouseId === warehouseId)?.quantity ?? 0;
}

function totalQty(state: StockTestState, productId: string) {
  return state.stockLevels
    .filter(s => s.productId === productId)
    .reduce((s, l) => s + l.quantity, 0);
}

function seedMenu(state: StockTestState) {
  const seeded = seedBasicCatalog(state);
  const w2 = randomUUID();
  state.warehouses.push({ id: w2, name: 'Barra', location: 'Salón' });
  state.stockLevels.push({ id: randomUUID(), productId: seeded.p1, warehouseId: w2, quantity: 3 });
  const spCoca = randomUUID();
  const spAgua = randomUUID();
  const spPromo = randomUUID();
  const spEmpty = randomUUID();
  state.salesProducts.push(
    { id: spCoca, name: 'Coca', categoriaVentaId: 'cat-bebidas', kitchenId: 'k-1', price: 500, kind: 'simple', active: true },
    { id: spAgua, name: 'Agua', categoriaVentaId: 'cat-bebidas', kitchenId: 'k-1', price: 400, kind: 'simple', active: true },
    { id: spPromo, name: 'Combo', categoriaVentaId: 'cat-promos', kitchenId: 'k-1', price: 800, kind: 'promo', active: true },
    { id: spEmpty, name: 'Sin receta', categoriaVentaId: 'cat-otros', kitchenId: 'k-1', price: 100, kind: 'simple', active: true },
  );
  state.recipes.push(
    { id: randomUUID(), salesProductId: spCoca, stockProductId: seeded.p1, quantity: 1 },
    { id: randomUUID(), salesProductId: spAgua, stockProductId: seeded.p2, quantity: 1 },
  );
  state.bundleItems.push({
    id: randomUUID(),
    promoProductId: spPromo,
    componentProductId: spCoca,
    quantity: 2,
  });
  return { ...seeded, w2, spCoca, spAgua, spPromo, spEmpty };
}

function createServices(state = createEmptyStockState()) {
  const prisma = createPrismaMock(state);
  const movements = new StockMovementsService(prisma as never);
  return {
    state,
    prisma,
    sales: new SalesService(prisma as never, movements),
    stock: new StockService(prisma as never, movements),
  };
}

describe('Sales ↔ stock — integridad transaccional', () => {
  let state: StockTestState;
  let sales: SalesService;
  let stock: StockService;
  let ids: ReturnType<typeof seedMenu>;

  beforeEach(() => {
    const created = createServices();
    state = created.state;
    sales = created.sales;
    stock = created.stock;
    ids = seedMenu(state);
  });

  it('checkout 1:1 descuenta, mueve y emite ticket', async () => {
    const before = totalQty(state, ids.p1);
    const result = await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 2 }],
      operatorId: 'op-1',
    });
    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(false);
    expect(result.ticket.status).toBe('emitido');
    expect(totalQty(state, ids.p1)).toBe(before - 2);
    expect(state.stockMovements.some(m => m.type === 'venta' && m.productId === ids.p1)).toBe(true);
    const allocs = result.ticket.stockAllocations as Array<{ quantity: number }>;
    expect(allocs.reduce((s, a) => s + a.quantity, 0)).toBe(2);
  });

  it('checkout con dos depósitos descuenta w1 y después w2', async () => {
    const before = totalQty(state, ids.p1);
    const result = await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 12 }],
      operatorId: 'op-1',
    });
    expect(totalQty(state, ids.p1)).toBe(before - 12);
    const allocs = result.ticket.stockAllocations as Array<{ warehouseId: string; quantity: number }>;
    expect(allocs.reduce((s, a) => s + a.quantity, 0)).toBe(12);
    expect(allocs.some(a => a.warehouseId === ids.whId)).toBe(true);
    expect(allocs.some(a => a.warehouseId === ids.w2)).toBe(true);
  });

  it('checkout insuficiente no toca stock ni crea ticket', async () => {
    const before = structuredClone(state.stockLevels);
    await expect(
      sales.checkout({
        items: [{ salesProductId: ids.spCoca, quantity: 99 }],
        operatorId: 'op-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(state.tickets).toHaveLength(0);
    expect(state.stockLevels.map(l => l.quantity)).toEqual(before.map(l => l.quantity));
  });

  it('checkout de simple sin receta → 409', async () => {
    await expect(
      sales.checkout({
        items: [{ salesProductId: ids.spEmpty, quantity: 1 }],
        operatorId: 'op-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(state.tickets).toHaveLength(0);
  });

  it('promo explota componentes', async () => {
    const before = totalQty(state, ids.p1);
    const result = await sales.checkout({
      items: [{ salesProductId: ids.spPromo, quantity: 1 }],
      operatorId: 'op-1',
    });
    expect(result.ok).toBe(true);
    expect(totalQty(state, ids.p1)).toBe(before - 2);
  });

  it('return restaura exactamente los depósitos de la venta', async () => {
    const sold = await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 12 }],
      operatorId: 'op-1',
    });
    expect(totalQty(state, ids.p1)).toBe(1);
    await sales.returnSale({ ticketId: sold.ticket.id, operatorId: 'op-1' });
    expect(qty(state, ids.p1, ids.whId)).toBe(10);
    expect(qty(state, ids.p1, ids.w2)).toBe(3);
    expect(state.tickets[0].status).toBe('devuelto');
  });

  it('cambiar la receta después de vender no altera el restore', async () => {
    const sold = await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 2 }],
      operatorId: 'op-1',
    });
    const recipe = state.recipes.find(r => r.salesProductId === ids.spCoca)!;
    recipe.stockProductId = ids.p2;
    recipe.quantity = 9;
    await sales.returnSale({ ticketId: sold.ticket.id, operatorId: 'op-1' });
    expect(qty(state, ids.p1, ids.whId)).toBe(10);
    expect(qty(state, ids.p2, ids.whId)).toBe(5);
  });

  it('void restaura el snapshot', async () => {
    const sold = await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 12 }],
      operatorId: 'op-1',
    });
    await sales.voidTicket(sold.ticket.id, 'op-1');
    expect(qty(state, ids.p1, ids.whId)).toBe(10);
    expect(qty(state, ids.p1, ids.w2)).toBe(3);
    expect(state.tickets[0].status).toBe('anulado');
  });

  it('devolución parcial no restaura de más', async () => {
    await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 5 }],
      operatorId: 'op-1',
    });
    await sales.returnItems({
      items: [{ salesProductId: ids.spCoca, quantity: 2 }],
      operatorId: 'op-1',
    });
    expect(totalQty(state, ids.p1)).toBe(10);
    await expect(
      sales.returnItems({
        items: [{ salesProductId: ids.spCoca, quantity: 9 }],
        operatorId: 'op-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('editar ticket restaura lo viejo y descuenta lo nuevo', async () => {
    const sold = await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 2 }],
      operatorId: 'op-1',
    });
    await sales.updateTicketItems(sold.ticket.id, {
      items: [{ salesProductId: ids.spAgua, quantity: 1 }],
      operatorId: 'op-1',
    });
    expect(qty(state, ids.p1, ids.whId)).toBe(10);
    expect(qty(state, ids.p2, ids.whId)).toBe(4);
  });

  it('idempotencia: misma key no vuelve a descontar', async () => {
    const key = 'idem-1';
    const first = await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 2 }],
      operatorId: 'op-1',
      idempotencyKey: key,
    });
    const second = await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 2 }],
      operatorId: 'op-1',
      idempotencyKey: key,
    });
    expect(second.idempotent).toBe(true);
    expect(second.ticket.id).toBe(first.ticket.id);
    expect(first.idempotent).toBe(false);
    expect(totalQty(state, ids.p1)).toBe(11);
    expect(state.tickets).toHaveLength(1);
  });

  it('consumo interno (registerConsumption): descuenta por receta, total $0, origen consumo', async () => {
    const result = await sales.registerConsumption({
      items: [{ salesProductId: ids.spCoca, quantity: 2 }],
      operatorId: 'op-1',
    });
    expect(result.ticket.total).toBe(0);
    expect(result.ticket.origen).toBe('consumo');
    expect(result.ticket.items[0].unitPrice).toBe(0);
    expect(totalQty(state, ids.p1)).toBe(11);
    const movement = state.stockMovements.find(m => m.reference === result.ticket.id);
    expect(movement?.type).toBe('consumo');
  });

  it('consumo no deja el nivel en negativo (mismo bloqueo que un checkout)', async () => {
    await expect(
      sales.registerConsumption({
        items: [{ salesProductId: ids.spCoca, quantity: 99 }],
        operatorId: 'op-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(qty(state, ids.p1, ids.whId)).toBe(10);
  });

  it('recepción de pedido y checkout dejan niveles coherentes', async () => {
    const supplier = await stock.createSupplier({ name: 'Prov', productIds: [ids.p1] });
    const order = await stock.createPurchaseOrder({
      supplierId: supplier.id,
      provider: 'Prov',
      items: [{ productId: ids.p1, quantityOrdered: 5 }],
    });
    await stock.receivePurchaseOrder(order.id, {
      items: [{
        productId: ids.p1,
        quantityReceived: 5,
        allocations: [{ warehouseId: ids.whId, quantity: 5 }],
      }],
      operatorId: 'op-1',
      operatorName: 'Admin',
    });
    expect(totalQty(state, ids.p1)).toBe(18);
    await sales.checkout({
      items: [{ salesProductId: ids.spCoca, quantity: 3 }],
      operatorId: 'op-1',
    });
    expect(totalQty(state, ids.p1)).toBe(15);
    expect(state.stockMovements.some(m => m.type === 'entrada')).toBe(true);
    expect(state.stockMovements.some(m => m.type === 'venta')).toBe(true);
  });

  it('persiste el emoji de la cocina al crear, editar y volver a listar', async () => {
    const created = await sales.createKitchen({ name: 'Patio', emoji: '🔥' });
    expect(created.emoji).toBe('🔥');
    expect((await sales.findAllKitchens()).find(k => k.id === created.id)?.emoji).toBe('🔥');

    const updated = await sales.updateKitchen(created.id, { emoji: '🍺' });
    expect(updated.emoji).toBe('🍺');
    expect((await sales.findAllKitchens()).find(k => k.id === created.id)?.emoji).toBe('🍺');
  });

  it('persiste el emoji del producto de venta al crear, editar y volver a listar', async () => {
    const created = await sales.createSalesProduct({
      name: 'Burger',
      categoriaVentaId: 'cat-comidas',
      kitchenId: 'k-1',
      price: 100,
      emoji: '🍔',
      recipe: [{ stockProductId: ids.p1, quantity: 1 }],
    });
    expect(created.emoji).toBe('🍔');
    expect((await sales.findAllSalesProducts()).find(p => p.id === created.id)?.emoji).toBe('🍔');

    const updated = await sales.updateSalesProduct(created.id, { emoji: '🥩' });
    expect(updated?.emoji).toBe('🥩');
    expect((await sales.findAllSalesProducts()).find(p => p.id === created.id)?.emoji).toBe('🥩');
  });
});
