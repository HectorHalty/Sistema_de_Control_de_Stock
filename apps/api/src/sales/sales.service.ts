import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { Prisma, EstadoTicket } from '@prisma/client';
import { isPrismaUniqueConflict } from '../common/prisma-errors';
import { assertVersionedUpdateApplied } from '../common/optimistic-lock';
import { normalizeLimit, toCursorPage, type CursorPage } from '../common/pagination';
import { PrismaService } from '../common/prisma.service';
import { StockMovementsService } from '../stock/stock-movements.service';
import { CheckoutDto, ReturnDto, ReturnItemsDto, UpdateTicketItemsDto } from './dto';
import {
  aggregateSalesLineItems,
  computeReturnableFromTotals,
  round3,
} from './sales-integrity';
import {
  SALES_PRODUCT_API_INCLUDE,
  allocateDeduction,
  assertNoPromoCycle,
  assertSimpleProductsHaveRecipes,
  assertValidPromoBundle,
  buildRequiredByStockProduct,
  invertSaleMovements,
  loadSalesProductsForStock,
  mergeAllocations,
  parseStockAllocations,
  scaleAllocations,
  splitAllocationsToItems,
  type StockAllocation,
} from './sales-stock';

interface TicketItemData extends Omit<Prisma.ItemTicketVentaUncheckedCreateWithoutTicketInput, 'createdAt'> {
  stockAllocations?: Prisma.InputJsonValue;
}

/** Tipo de retorno explícito para findAllTickets — ver comentario en Task 9. */
type TicketWithItems = Prisma.TicketVentaGetPayload<{
  include: { items: true; operator: { select: { username: true } } };
}>;

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private movements: StockMovementsService,
  ) {}

  // ============ CRITICAL: Transactional Checkout ============
  // Uses Prisma interactive transactions with SELECT FOR UPDATE
  // to prevent race conditions on stock deduction.

  async checkout(dto: CheckoutDto) {
    const operatorId = dto.operatorId ?? 'local';
    const ticketInclude = { items: true, operator: { select: { name: true, username: true } } } as const;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.idempotencyKey) {
          const existing = await tx.ticketVenta.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
            include: ticketInclude,
          });
          if (existing) {
            return { ok: true as const, ticket: existing, idempotent: true };
          }
        }

        const salesProductIds = [...new Set(dto.items.map(i => i.salesProductId))];
        const salesProducts = await tx.productoVenta.findMany({
          where: { id: { in: salesProductIds }, active: true },
        });
        if (salesProducts.length !== salesProductIds.length) {
          const found = new Set(salesProducts.map(p => p.id));
          const missing = salesProductIds.filter(id => !found.has(id));
          throw new NotFoundException(`Sales products not found or inactive: ${missing.join(', ')}`);
        }

        const salesProductMap = await loadSalesProductsForStock(tx, salesProductIds);
        assertSimpleProductsHaveRecipes(dto.items, salesProductMap);
        const requiredByStockProduct = buildRequiredByStockProduct(dto.items, salesProductMap);
        const salesProductMapForPricing = new Map(salesProducts.map(p => [p.id, p]));

        const stockProductIds = Object.keys(requiredByStockProduct);
        const lockedLevels = await this.lockStockLevels(tx, stockProductIds);
        const { allocations, missing } = allocateDeduction(lockedLevels, requiredByStockProduct);
        if (missing.length > 0) {
          throw new ConflictException({
            message: 'Insufficient stock for checkout',
            missing,
          });
        }

        await this.applyStockDelta(tx, allocations, -1);

        const ticketNumber = await this.nextTicketNumber(tx);
        const perItemAlloc = splitAllocationsToItems(dto.items, salesProductMap, allocations);

        let total = 0;
        const ticketItems: TicketItemData[] = [];
        dto.items.forEach((item, index) => {
          const sp = salesProductMapForPricing.get(item.salesProductId)!;
          total += Number(sp.price) * item.quantity;
          ticketItems.push({
            salesProductId: item.salesProductId,
            name: sp.name,
            unitPrice: sp.price,
            quantity: item.quantity,
            stockAllocations: perItemAlloc[index] as unknown as Prisma.InputJsonValue,
          });
        });

        const ticket = await tx.ticketVenta.create({
          data: {
            number: ticketNumber,
            status: 'emitido',
            total,
            operatorId,
            note: dto.note,
            idempotencyKey: dto.idempotencyKey,
            stockAllocations: allocations as unknown as Prisma.InputJsonValue,
            items: { create: ticketItems },
          },
          include: ticketInclude,
        });

        const operatorName = ticket.operator?.name ?? ticket.operator?.username ?? operatorId;
        await this.movements.recordMany(
          tx,
          allocations.map(a => ({
            type: 'venta' as const,
            productId: a.stockProductId,
            warehouseId: a.warehouseId,
            quantity: -a.quantity,
            reference: ticket.id,
            operatorId,
            operatorName,
          })),
        );

        const kitchenGroups: Record<string, typeof ticketItems> = {};
        for (const item of ticketItems) {
          const sp = salesProductMapForPricing.get(item.salesProductId)!;
          const kitchenId = sp.kitchenId;
          if (!kitchenGroups[kitchenId]) kitchenGroups[kitchenId] = [];
          kitchenGroups[kitchenId].push(item);
        }

        const kitchens = await tx.cocina.findMany({
          where: { id: { in: Object.keys(kitchenGroups) }, active: true },
        });
        const kitchenMap = new Map(kitchens.map(k => [k.id, k]));

        for (const [kitchenId, items] of Object.entries(kitchenGroups)) {
          const kitchen = kitchenMap.get(kitchenId);
          if (!kitchen) continue;
          await tx.ordenCocina.create({
            data: {
              ticketId: ticket.id,
              ticketNumber: ticket.number,
              kitchenId,
              status: 'pending',
              operatorName,
              items: {
                create: items.map(i => ({
                  salesProductId: i.salesProductId,
                  name: i.name,
                  quantity: i.quantity,
                })),
              },
            },
          });
        }

        return { ok: true as const, ticket, idempotent: false };
      }, {
        maxWait: 5000,
        timeout: 10000,
      });
    } catch (e) {
      if (dto.idempotencyKey && isPrismaUniqueConflict(e)) {
        const existing = await this.prisma.ticketVenta.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: ticketInclude,
        });
        if (existing) return { ok: true as const, ticket: existing, idempotent: true };
      }
      throw e;
    }
  }

  // ============ CRITICAL: Transactional Return ============

  async returnSale(dto: ReturnDto) {
    const operatorId = dto.operatorId ?? 'local';

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.idempotencyKey) {
          const existing = await tx.ticketVenta.findFirst({
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (existing) {
            return { ok: true as const, ticket: existing, idempotent: true };
          }
        }

        await tx.$queryRaw`
          SELECT id FROM "tickets_venta" WHERE id::text = ${dto.ticketId} FOR UPDATE
        `;

        const ticket = await tx.ticketVenta.findUnique({
          where: { id: dto.ticketId },
          include: { items: true },
        });

        if (!ticket) throw new NotFoundException(`Ticket ${dto.ticketId} not found`);
        if (ticket.status === 'devuelto') throw new ConflictException('Ticket already returned');
        if (ticket.status === 'anulado') throw new ConflictException('Ticket is voided');

        const allocations = await this.resolveTicketAllocations(tx, ticket);
        await this.restoreAllocations(tx, allocations, operatorId, dto.ticketId, 'devolucion');

        const updated = await tx.ticketVenta.update({
          where: { id: dto.ticketId },
          data: { status: 'devuelto' },
          include: { items: true },
        });

        return { ok: true as const, ticket: updated, idempotent: false };
      }, {
        maxWait: 5000,
        timeout: 10000,
      });
    } catch (e) {
      if (dto.idempotencyKey && isPrismaUniqueConflict(e)) {
        const existing = await this.prisma.ticketVenta.findFirst({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) return { ok: true as const, ticket: existing, idempotent: true };
      }
      throw e;
    }
  }

  // ============ Partial return by products (POS devoluciones) ============

  async returnItems(dto: ReturnItemsDto) {
    const operatorId = dto.operatorId ?? 'local';
    const aggregated = aggregateSalesLineItems(dto.items);
    if (!aggregated.length) {
      throw new ConflictException('Return must include at least one item');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.idempotencyKey) {
          const existing = await tx.ticketVenta.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (existing) {
            return { ok: true as const, ticket: existing, idempotent: true };
          }
        }

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('sales-return-items'))`;

        const { sold, returned } = await this.getSoldAndReturnedByProduct(tx);
        const returnable = computeReturnableFromTotals(sold, returned);
        const shortages: Array<{ salesProductId: string; requested: number; available: number }> = [];
        for (const item of aggregated) {
          const available = returnable[item.salesProductId] || 0;
          if (item.quantity > available) {
            shortages.push({ salesProductId: item.salesProductId, requested: item.quantity, available });
          }
        }
        if (shortages.length > 0) {
          throw new ConflictException({
            message: 'Return quantity exceeds sold amount',
            shortages,
          });
        }

        const salesProductIds = aggregated.map(i => i.salesProductId);
        const salesProducts = await tx.productoVenta.findMany({
          where: { id: { in: salesProductIds }, active: true },
        });
        if (salesProducts.length !== salesProductIds.length) {
          throw new NotFoundException('One or more sales products not found or inactive');
        }
        const spMapForPricing = new Map(salesProducts.map(p => [p.id, p]));

        const restoreAllocations = await this.allocationsForPartialReturn(tx, aggregated, sold);

        const ticketNumber = await this.nextTicketNumber(tx);
        let total = 0;
        const ticketItems: TicketItemData[] = [];
        for (const item of aggregated) {
          const sp = spMapForPricing.get(item.salesProductId)!;
          total += Number(sp.price) * item.quantity;
          ticketItems.push({
            salesProductId: item.salesProductId,
            name: sp.name,
            unitPrice: sp.price,
            quantity: item.quantity,
          });
        }

        const ticket = await tx.ticketVenta.create({
          data: {
            number: ticketNumber,
            status: 'devuelto',
            total,
            operatorId,
            note: dto.note ?? 'Devolución parcial',
            idempotencyKey: dto.idempotencyKey,
            stockAllocations: restoreAllocations as unknown as Prisma.InputJsonValue,
            items: { create: ticketItems },
          },
          include: { items: true, operator: { select: { name: true, username: true } } },
        });

        await this.restoreAllocations(tx, restoreAllocations, operatorId, ticket.id, 'devolucion');

        return { ok: true as const, ticket, idempotent: false };
      }, {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e) {
      if (dto.idempotencyKey && isPrismaUniqueConflict(e)) {
        const existing = await this.prisma.ticketVenta.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) return { ok: true as const, ticket: existing, idempotent: true };
      }
      throw e;
    }
  }

  // ============ Edit issued ticket items ============

  async updateTicketItems(ticketId: string, dto: UpdateTicketItemsDto) {
    const operatorId = dto.operatorId ?? 'local';
    const newItems = aggregateSalesLineItems(dto.items);
    if (!newItems.length) {
      throw new ConflictException('Ticket must include at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "tickets_venta" WHERE id::text = ${ticketId} FOR UPDATE
      `;

      const ticket = await tx.ticketVenta.findUnique({
        where: { id: ticketId },
        include: { items: true },
      });
      if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
      if (ticket.status !== 'emitido') {
        throw new ConflictException('Can only edit issued tickets');
      }

      const allProductIds = [
        ...new Set([
          ...ticket.items.map(i => i.salesProductId),
          ...newItems.map(i => i.salesProductId),
        ]),
      ];
      const salesProducts = await tx.productoVenta.findMany({
        where: { id: { in: allProductIds } },
      });
      const spMap = await loadSalesProductsForStock(tx, allProductIds);
      const spMapForPricing = new Map(salesProducts.map(p => [p.id, p]));

      const inactiveNew = newItems.filter(i => !salesProducts.find(p => p.id === i.salesProductId && p.active));
      if (inactiveNew.length > 0) {
        throw new ConflictException('One or more sales products not found or inactive');
      }

      assertSimpleProductsHaveRecipes(newItems, spMap);

      const oldAllocations = await this.resolveTicketAllocations(tx, ticket);
      await this.restoreAllocations(tx, oldAllocations, operatorId, ticketId, 'venta_anulada');

      const requiredByStockProduct = buildRequiredByStockProduct(newItems, spMap);
      const stockProductIds = Object.keys(requiredByStockProduct);
      let newAllocations: StockAllocation[] = [];
      if (stockProductIds.length > 0) {
        const lockedLevels = await this.lockStockLevels(tx, stockProductIds);
        const { allocations, missing } = allocateDeduction(lockedLevels, requiredByStockProduct);
        if (missing.length > 0) {
          throw new ConflictException({
            message: 'Insufficient stock for ticket update',
            missing,
          });
        }
        newAllocations = allocations;
        await this.applyStockDelta(tx, allocations, -1);
        const operator = await tx.usuario.findUnique({ where: { id: operatorId } });
        await this.movements.recordMany(
          tx,
          allocations.map(a => ({
            type: 'venta' as const,
            productId: a.stockProductId,
            warehouseId: a.warehouseId,
            quantity: -a.quantity,
            reference: ticketId,
            operatorId,
            operatorName: operator?.name ?? operator?.username,
          })),
        );
      }

      await tx.itemTicketVenta.deleteMany({ where: { ticketId } });

      const perItemAlloc = splitAllocationsToItems(newItems, spMap, newAllocations);
      let total = 0;
      const ticketItemRows: TicketItemData[] = [];
      newItems.forEach((item, index) => {
        const sp = spMapForPricing.get(item.salesProductId)!;
        total += Number(sp.price) * item.quantity;
        ticketItemRows.push({
          salesProductId: item.salesProductId,
          name: sp.name,
          unitPrice: sp.price,
          quantity: item.quantity,
          stockAllocations: perItemAlloc[index] as unknown as Prisma.InputJsonValue,
        });
      });

      await tx.itemTicketVenta.createMany({
        data: ticketItemRows.map(i => ({ ...i, ticketId })),
      });

      await tx.ordenCocina.deleteMany({ where: { ticketId } });
      const kitchenGroups: Record<string, typeof ticketItemRows> = {};
      for (const item of ticketItemRows) {
        const sp = spMapForPricing.get(item.salesProductId);
        if (!sp) continue;
        if (!kitchenGroups[sp.kitchenId]) kitchenGroups[sp.kitchenId] = [];
        kitchenGroups[sp.kitchenId].push(item);
      }
      const kitchens = await tx.cocina.findMany({
        where: { id: { in: Object.keys(kitchenGroups) }, active: true },
      });
      const kitchenMap = new Map(kitchens.map(k => [k.id, k]));
      const operator = await tx.usuario.findUnique({ where: { id: operatorId } });
      const operatorName = operator?.name ?? operator?.username ?? operatorId;
      for (const [kitchenId, items] of Object.entries(kitchenGroups)) {
        if (!kitchenMap.get(kitchenId)) continue;
        await tx.ordenCocina.create({
          data: {
            ticketId,
            ticketNumber: ticket.number,
            kitchenId,
            status: 'pending',
            operatorName,
            items: {
              create: items.map(i => ({
                salesProductId: i.salesProductId,
                name: i.name,
                quantity: i.quantity,
              })),
            },
          },
        });
      }

      return tx.ticketVenta.update({
        where: { id: ticketId },
        data: {
          total,
          stockAllocations: newAllocations as unknown as Prisma.InputJsonValue,
        },
        include: { items: true, operator: { select: { username: true } } },
      });
    }, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  // ============ Stock helpers ============

  private async lockStockLevels(
    tx: Prisma.TransactionClient,
    stockProductIds: string[],
  ): Promise<Array<{ productId: string; warehouseId: string; quantity: number }>> {
    if (stockProductIds.length === 0) return [];
    return tx.$queryRaw`
      SELECT sl."productId", sl."warehouseId", sl.quantity
      FROM "niveles_stock" sl
      WHERE sl."productId"::text = ANY(${stockProductIds}::text[])
      ORDER BY sl."productId", sl."warehouseId"
      FOR UPDATE
    ` as unknown as Array<{ productId: string; warehouseId: string; quantity: number }>;
  }

  /** sign = -1 descuenta, +1 restaura. */
  private async applyStockDelta(
    tx: Prisma.TransactionClient,
    allocations: StockAllocation[],
    sign: 1 | -1,
  ): Promise<void> {
    for (const alloc of allocations) {
      const delta = round3(sign * alloc.quantity);
      if (delta === 0) continue;
      const updated = await tx.$executeRaw`
        UPDATE "niveles_stock"
        SET quantity = quantity + ${delta}, "updatedAt" = NOW()
        WHERE "productId"::text = ${alloc.stockProductId}
          AND "warehouseId"::text = ${alloc.warehouseId}
      `;
      if (updated === 0 && sign > 0) {
        await tx.nivelStock.create({
          data: {
            productId: alloc.stockProductId,
            warehouseId: alloc.warehouseId,
            quantity: alloc.quantity,
          },
        });
      }
    }
  }

  private async restoreAllocations(
    tx: Prisma.TransactionClient,
    allocations: StockAllocation[],
    operatorId: string,
    reference: string,
    movementType: 'devolucion' | 'venta_anulada',
  ): Promise<void> {
    const merged = mergeAllocations(allocations);
    if (merged.length === 0) return;
    const productIds = [...new Set(merged.map(a => a.stockProductId))];
    await this.lockStockLevels(tx, productIds);
    await this.applyStockDelta(tx, merged, 1);
    const operator = await tx.usuario.findUnique({ where: { id: operatorId } });
    await this.movements.recordMany(
      tx,
      merged.map(a => ({
        type: movementType,
        productId: a.stockProductId,
        warehouseId: a.warehouseId,
        quantity: a.quantity,
        reference,
        operatorId,
        operatorName: operator?.name ?? operator?.username,
      })),
    );
  }

  private async resolveTicketAllocations(
    tx: Prisma.TransactionClient,
    ticket: { id: string; stockAllocations?: unknown; items: Array<{ stockAllocations?: unknown }> },
  ): Promise<StockAllocation[]> {
    const fromTicket = parseStockAllocations(ticket.stockAllocations);
    if (fromTicket.length > 0) return fromTicket;

    const fromItems = mergeAllocations(
      ticket.items.flatMap(i => parseStockAllocations(i.stockAllocations)),
    );
    if (fromItems.length > 0) return fromItems;

    const movements = await tx.movimientoStock.findMany({
      where: { reference: ticket.id, type: 'venta' },
    });
    return invertSaleMovements(
      movements.map(m => ({
        productId: m.productId,
        warehouseId: m.warehouseId,
        quantity: Number(m.quantity),
      })),
    );
  }

  private async allocationsForPartialReturn(
    tx: Prisma.TransactionClient,
    returned: Array<{ salesProductId: string; quantity: number }>,
    sold: Record<string, number>,
  ): Promise<StockAllocation[]> {
    const productIds = returned.map(r => r.salesProductId);
    const emitidoItems = await tx.itemTicketVenta.findMany({
      where: {
        salesProductId: { in: productIds },
        ticket: { status: 'emitido' },
      },
    });

    const allocsByProduct = new Map<string, StockAllocation[]>();
    for (const item of emitidoItems) {
      const parsed = parseStockAllocations(item.stockAllocations);
      const list = allocsByProduct.get(item.salesProductId) ?? [];
      list.push(...parsed);
      allocsByProduct.set(item.salesProductId, list);
    }

    const restored: StockAllocation[] = [];
    for (const item of returned) {
      const soldQty = sold[item.salesProductId] || 0;
      if (soldQty <= 0) continue;
      const original = mergeAllocations(allocsByProduct.get(item.salesProductId) ?? []);
      if (original.length > 0) {
        restored.push(...scaleAllocations(original, item.quantity / soldQty));
        continue;
      }
      // Tickets viejos sin snapshot: receta vigente (mejor esfuerzo).
      const spMap = await loadSalesProductsForStock(tx, [item.salesProductId]);
      const required = buildRequiredByStockProduct([item], spMap);
      const levels = await this.lockStockLevels(tx, Object.keys(required));
      for (const [stockProductId, qty] of Object.entries(required)) {
        const level = levels.find(l => l.productId === stockProductId);
        if (!level) continue;
        restored.push({ stockProductId, warehouseId: level.warehouseId, quantity: qty });
      }
    }
    return mergeAllocations(restored);
  }

  private async getSoldAndReturnedByProduct(tx: Prisma.TransactionClient): Promise<{
    sold: Record<string, number>;
    returned: Record<string, number>;
  }> {
    const rows = await tx.$queryRaw`
      SELECT
        t.status,
        i."salesProductId",
        SUM(i.quantity)::float AS qty
      FROM "tickets_venta" t
      JOIN "items_ticket_venta" i ON i."ticketId" = t.id
      WHERE t.status IN ('emitido', 'devuelto')
      GROUP BY t.status, i."salesProductId"
    ` as unknown as Array<{ status: string; salesProductId: string; qty: number }>;

    const sold: Record<string, number> = {};
    const returned: Record<string, number> = {};
    for (const row of rows) {
      const qty = round3(Number(row.qty));
      if (row.status === 'emitido') {
        sold[row.salesProductId] = round3((sold[row.salesProductId] || 0) + qty);
      } else {
        returned[row.salesProductId] = round3((returned[row.salesProductId] || 0) + qty);
      }
    }
    return { sold, returned };
  }

  // ============ Sales Products CRUD ============

  async findAllSalesProducts() {
    return this.prisma.productoVenta.findMany({
      where: { active: true },
      include: SALES_PRODUCT_API_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findSalesProductById(id: string) {
    const product = await this.prisma.productoVenta.findUnique({
      where: { id },
      include: SALES_PRODUCT_API_INCLUDE,
    });
    if (!product) throw new NotFoundException(`Sales product ${id} not found`);
    return product;
  }

  private async validatePromoBundle(
    promoId: string | undefined,
    bundle: Array<{ componentProductId: string; quantity: number }>,
  ) {
    assertValidPromoBundle(promoId, bundle);
    const componentIds = bundle.map(b => b.componentProductId);
    const found = await this.prisma.productoVenta.findMany({
      where: { id: { in: componentIds }, active: true },
    });
    if (found.length !== componentIds.length) {
      throw new BadRequestException('Uno o más productos de la promo no existen o están inactivos');
    }
    const graph = await loadSalesProductsForStock(this.prisma, componentIds);
    if (promoId) {
      graph.set(promoId, {
        id: promoId,
        kind: 'promo',
        recipe: [],
        bundleItems: bundle.map(b => ({
          componentProductId: b.componentProductId,
          quantity: b.quantity,
        })),
      });
      assertNoPromoCycle(promoId, bundle, graph);
    }
  }

  async createSalesProduct(data: {
    name: string; categoriaVentaId: string; kitchenId: string; price: number;
    emoji?: string; kind?: string;
    recipe?: { stockProductId: string; quantity: number }[];
    bundle?: { componentProductId: string; quantity: number }[];
  }) {
    const kind = data.kind === 'promo' ? 'promo' : 'simple';

    if (kind === 'promo') {
      await this.validatePromoBundle(undefined, data.bundle ?? []);
      return this.prisma.productoVenta.create({
        data: {
          name: data.name,
          categoriaVentaId: data.categoriaVentaId,
          kitchenId: data.kitchenId,
          price: data.price,
          emoji: data.emoji ?? '🍽️',
          kind: 'promo',
          bundleItems: {
            create: (data.bundle ?? []).map(b => ({
              componentProductId: b.componentProductId,
              quantity: b.quantity,
            })),
          },
        },
        include: SALES_PRODUCT_API_INCLUDE,
      });
    }

    return this.prisma.productoVenta.create({
      data: {
        name: data.name,
        categoriaVentaId: data.categoriaVentaId,
        kitchenId: data.kitchenId,
        price: data.price,
        emoji: data.emoji ?? '🍽️',
        kind: 'simple',
        recipe: { create: data.recipe ?? [] },
      },
      include: SALES_PRODUCT_API_INCLUDE,
    });
  }

  async updateSalesProduct(id: string, data: {
    name?: string; categoriaVentaId?: string; kitchenId?: string;
    price?: number; emoji?: string; active?: boolean; kind?: string;
    recipe?: { stockProductId: string; quantity: number }[];
    bundle?: { componentProductId: string; quantity: number }[];
    version?: number;
  }) {
    await this.findSalesProductById(id);

    return this.prisma.$transaction(async (tx) => {
      const { recipe, bundle, kind, version, ...productData } = data;
      const nextKind = kind === 'promo' ? 'promo' : kind === 'simple' ? 'simple' : undefined;

      if (nextKind === 'promo') {
        await this.validatePromoBundle(id, bundle ?? []);
      }

      const updateData: Prisma.ProductoVentaUpdateInput = {
        ...productData,
        ...(nextKind ? { kind: nextKind } : {}),
      };
      if (version !== undefined) {
        const { count } = await tx.productoVenta.updateMany({
          where: { id, version },
          data: { ...updateData, version: { increment: 1 } },
        });
        assertVersionedUpdateApplied(count);
      } else {
        await tx.productoVenta.update({ where: { id }, data: updateData });
      }

      if (nextKind === 'promo') {
        await tx.itemReceta.deleteMany({ where: { salesProductId: id } });
        await tx.itemComboVenta.deleteMany({ where: { promoProductId: id } });
        if (bundle && bundle.length > 0) {
          await tx.itemComboVenta.createMany({
            data: bundle.map(b => ({
              promoProductId: id,
              componentProductId: b.componentProductId,
              quantity: b.quantity,
            })),
          });
        }
      } else if (nextKind === 'simple' || recipe !== undefined) {
        await tx.itemComboVenta.deleteMany({ where: { promoProductId: id } });
        await tx.itemReceta.deleteMany({ where: { salesProductId: id } });
        if (recipe && recipe.length > 0) {
          await tx.itemReceta.createMany({
            data: recipe.map(r => ({ salesProductId: id, ...r })),
          });
        }
        if (nextKind === 'simple') {
          await tx.productoVenta.update({ where: { id }, data: { kind: 'simple' } });
        }
      }

      return tx.productoVenta.findUnique({
        where: { id },
        include: SALES_PRODUCT_API_INCLUDE,
      });
    });
  }

  // ============ Tickets ============

  /**
   * Sin `cursor`: mantiene el `take: 100` histórico (compatibilidad). Con
   * `cursor` (y opcionalmente `limit`), pagina de verdad — antes no había
   * forma de ver tickets más viejos que los últimos 100. Ver Task 9 de
   * docs/superpowers/plans/2026-09-07-integridad-operacional-b.md.
   */
  async findAllTickets(status?: string, operatorId?: string): Promise<TicketWithItems[]>;
  async findAllTickets(
    status: string | undefined,
    operatorId: string | undefined,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<CursorPage<TicketWithItems>>;
  async findAllTickets(status?: string, operatorId?: string, cursor?: string, limit?: number) {
    const where = {
      ...(status ? { status: status as EstadoTicket } : {}),
      ...(operatorId ? { operatorId } : {}),
    };
    const include = { items: true, operator: { select: { username: true } } } as const;

    if (cursor === undefined) {
      return this.prisma.ticketVenta.findMany({
        where, include, orderBy: { createdAt: 'desc' }, take: limit ? normalizeLimit(limit) : 100,
      });
    }
    const take = normalizeLimit(limit);
    const rows = await this.prisma.ticketVenta.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      cursor: { id: cursor },
      skip: 1,
      take: take + 1,
    });
    return toCursorPage(rows, take);
  }

  async findTicketById(id: string, operatorId?: string) {
    const ticket = await this.prisma.ticketVenta.findUnique({
      where: { id },
      include: { items: true, kitchenOrders: true },
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    if (operatorId && ticket.operatorId !== operatorId) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }
    return ticket;
  }

  async voidTicket(ticketId: string, operatorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "tickets_venta" WHERE id::text = ${ticketId} FOR UPDATE
      `;

      const ticket = await tx.ticketVenta.findUnique({
        where: { id: ticketId },
        include: { items: true },
      });
      if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
      if (ticket.status !== 'emitido') throw new ConflictException('Can only void issued tickets');

      const allocations = await this.resolveTicketAllocations(tx, ticket);
      await this.restoreAllocations(tx, allocations, operatorId, ticketId, 'venta_anulada');

      return tx.ticketVenta.update({
        where: { id: ticketId },
        data: { status: 'anulado' },
        include: { items: true },
      });
    }, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  // ============ Kitchens ============

  async findAllKitchens() {
    return this.prisma.cocina.findMany({ orderBy: { name: 'asc' } });
  }

  async createKitchen(data: { name: string; emoji?: string }) {
    return this.prisma.cocina.create({
      data: {
        name: data.name,
        emoji: data.emoji ?? '🍽️',
      },
    });
  }

  async updateKitchen(id: string, data: { name?: string; emoji?: string; active?: boolean }) {
    const existing = await this.prisma.cocina.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Kitchen ${id} not found`);
    return this.prisma.cocina.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  async deleteKitchen(id: string) {
    const existing = await this.prisma.cocina.findUnique({
      where: { id },
      include: { _count: { select: { salesProducts: true, orders: true } } },
    });
    if (!existing) throw new NotFoundException(`Kitchen ${id} not found`);
    if (existing._count.salesProducts > 0) {
      throw new ConflictException(
        `No se puede eliminar la cocina: tiene ${existing._count.salesProducts} producto(s) asignado(s).`,
      );
    }
    if (existing._count.orders > 0) {
      throw new ConflictException(
        'No se puede eliminar la cocina: tiene comandas asociadas. Desactivala en su lugar.',
      );
    }
    return this.prisma.cocina.delete({ where: { id } });
  }

  /** Incrementa el contador bajo lock de fila (seguro ante checkout concurrente). */
  private async nextTicketNumber(tx: Prisma.TransactionClient): Promise<number> {
    await tx.contadorTicket.upsert({
      where: { id: 'default' },
      create: { id: 'default', valor: 1000 },
      update: {},
    });
    const updated = await tx.contadorTicket.update({
      where: { id: 'default' },
      data: { valor: { increment: 1 } },
    });
    return updated.valor;
  }
}
