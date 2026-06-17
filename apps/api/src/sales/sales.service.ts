import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { StockMovementsService } from '../stock/stock-movements.service';
import { CheckoutDto, ReturnDto, ReturnItemsDto, UpdateTicketItemsDto } from './dto';
import {
  aggregateSalesLineItems,
  computeReturnableFromTotals,
  netRestoreQuantitiesAfterPartialReturns,
  round3,
} from './sales-integrity';
import {
  SALES_PRODUCT_API_INCLUDE,
  assertNoPromoCycle,
  assertValidPromoBundle,
  buildRequiredByStockProduct,
  loadSalesProductsForStock,
} from './sales-stock';

interface MissingStockItem {
  stockProductId: string;
  required: number;
  available: number;
}

interface TicketItemData extends Omit<Prisma.SalesTicketItemUncheckedCreateWithoutTicketInput, 'createdAt'> {}

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
    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.salesTicket.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true, operator: { select: { name: true, username: true } } },
      });
      if (existing) {
        return { ok: true, ticket: existing, idempotent: true };
      }
    }

    // Validate sales products exist and are active
    const salesProductIds = [...new Set(dto.items.map(i => i.salesProductId))];
    const salesProducts = await this.prisma.salesProduct.findMany({
      where: { id: { in: salesProductIds }, active: true },
    });

    if (salesProducts.length !== salesProductIds.length) {
      const found = new Set(salesProducts.map(p => p.id));
      const missing = salesProductIds.filter(id => !found.has(id));
      throw new NotFoundException(`Sales products not found or inactive: ${missing.join(', ')}`);
    }

    const salesProductMap = await loadSalesProductsForStock(this.prisma, salesProductIds);
    const requiredByStockProduct = buildRequiredByStockProduct(dto.items, salesProductMap);
    const salesProductMapForPricing = new Map(salesProducts.map(p => [p.id, p]));

    // Execute transaction with row-level locking
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock stock levels FOR UPDATE to prevent concurrent modification
      const stockProductIds = Object.keys(requiredByStockProduct);
      const lockedLevels = await tx.$queryRaw`
        SELECT sl.*, p.name as "productName"
        FROM "StockLevel" sl
        JOIN "Product" p ON p.id = sl."productId"
        WHERE sl."productId"::text = ANY(${stockProductIds}::text[])
        FOR UPDATE
      ` as Array<{ productId: string; quantity: number; warehouseId: string; productName: string }>;

      // Build available totals per stock product (Decimal llega como string en SQL crudo)
      const availableByProduct: Record<string, number> = {};
      for (const level of lockedLevels) {
        availableByProduct[level.productId] = round3(
          (availableByProduct[level.productId] || 0) + Number(level.quantity),
        );
      }

      // Validate stock availability
      const missing: MissingStockItem[] = [];
      for (const [stockProductId, requiredQty] of Object.entries(requiredByStockProduct)) {
        const available = availableByProduct[stockProductId] || 0;
        if (available < requiredQty) {
          missing.push({ stockProductId, required: requiredQty, available });
        }
      }

      if (missing.length > 0) {
        throw new ConflictException({
          message: 'Insufficient stock for checkout',
          missing,
        });
      }

      // Deduct stock atomically and registrar movimientos por almacén
      let remainingByProduct = { ...requiredByStockProduct };
      const movementEntries: Array<{
        type: 'venta';
        productId: string;
        warehouseId: string;
        quantity: number;
        reference: string;
        operatorId: string;
      }> = [];

      for (const level of lockedLevels) {
        const required = remainingByProduct[level.productId] || 0;
        if (required <= 0) continue;

        const deduction = round3(Math.min(Number(level.quantity), required));
        remainingByProduct[level.productId] = round3(remainingByProduct[level.productId] - deduction);

        await tx.$executeRaw`
          UPDATE "StockLevel" SET quantity = quantity - ${deduction}, "updatedAt" = NOW()
          WHERE "productId"::text = ${level.productId} AND "warehouseId"::text = ${level.warehouseId}
        `;

        movementEntries.push({
          type: 'venta',
          productId: level.productId,
          warehouseId: level.warehouseId,
          quantity: -deduction,
          reference: '', // se completa con ticket.id después de crear el ticket
          operatorId: operatorId,
        });
      }

      // Get next ticket number atomically
      const counter = await tx.$queryRaw`
        SELECT COALESCE(MAX(number), 999) + 1 as next_num FROM "SalesTicket"
      ` as Array<{ next_num: number }>;
      const ticketNumber = counter[0].next_num;

      // Calculate total
      let total = 0;
      const ticketItems: TicketItemData[] = [];
      for (const item of dto.items) {
        const sp = salesProductMapForPricing.get(item.salesProductId)!;
        const lineTotal = Number(sp.price) * item.quantity;
        total += lineTotal;
        ticketItems.push({
          salesProductId: item.salesProductId,
          name: sp.name,
          unitPrice: sp.price,
          quantity: item.quantity,
        });
      }

      // Create ticket
      const ticket = await tx.salesTicket.create({
        data: {
          number: ticketNumber,
          status: 'emitido',
          total,
          operatorId: operatorId,
          note: dto.note,
          idempotencyKey: dto.idempotencyKey,
          items: { create: ticketItems },
        },
        include: { items: true, operator: { select: { name: true, username: true } } },
      });

      const operatorName = ticket.operator?.name ?? ticket.operator?.username;
      await this.movements.recordMany(
        tx,
        movementEntries.map(m => ({
          ...m,
          reference: ticket.id,
          operatorName,
        })),
      );

      // Create kitchen orders
      const kitchenGroups: Record<string, typeof ticketItems> = {};
      for (const item of ticketItems) {
        const sp = salesProductMapForPricing.get(item.salesProductId)!;
        const kitchenId = sp.kitchenId;
        if (!kitchenGroups[kitchenId]) kitchenGroups[kitchenId] = [];
        kitchenGroups[kitchenId].push(item);
      }

      const kitchens = await tx.kitchen.findMany({
        where: { id: { in: Object.keys(kitchenGroups) }, active: true },
      });
      const kitchenMap = new Map(kitchens.map(k => [k.id, k]));

      for (const [kitchenId, items] of Object.entries(kitchenGroups)) {
        const kitchen = kitchenMap.get(kitchenId);
        if (!kitchen) continue;

        const ko = await tx.kitchenOrder.create({
          data: {
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            kitchenId,
            status: 'pending',
            operatorName: operatorId, // simplified
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

      return { ok: true, ticket, idempotent: false };
    }, {
      maxWait: 5000,
      timeout: 10000,
    });

    return result;
  }

  // ============ CRITICAL: Transactional Return ============

  async returnSale(dto: ReturnDto) {
    const operatorId = dto.operatorId ?? 'local';
    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.salesTicket.findFirst({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return { ok: true, ticket: existing, idempotent: true };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.salesTicket.findUnique({
        where: { id: dto.ticketId },
        include: { items: true },
      });

      if (!ticket) throw new NotFoundException(`Ticket ${dto.ticketId} not found`);
      if (ticket.status === 'devuelto') throw new ConflictException('Ticket already returned');
      if (ticket.status === 'anulado') throw new ConflictException('Ticket is voided');

      const salesProductIds = [...new Set(ticket.items.map(i => i.salesProductId))];
      const spMap = await loadSalesProductsForStock(tx, salesProductIds);
      const restoreByStockProduct = buildRequiredByStockProduct(
        ticket.items.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
        spMap,
      );

      // Restore stock atomically
      const restoreMovements: Array<{
        type: 'devolucion';
        productId: string;
        warehouseId: string;
        quantity: number;
        reference: string;
        operatorId: string;
      }> = [];

      for (const [stockProductId, qty] of Object.entries(restoreByStockProduct)) {
        const levels = await tx.stockLevel.findMany({
          where: { productId: stockProductId },
          orderBy: { warehouseId: 'asc' },
        });

        if (levels.length > 0) {
          await tx.$executeRaw`
            UPDATE "StockLevel" SET quantity = quantity + ${qty}, "updatedAt" = NOW()
            WHERE id::text = ${levels[0].id}
          `;
          restoreMovements.push({
            type: 'devolucion',
            productId: stockProductId,
            warehouseId: levels[0].warehouseId,
            quantity: qty,
            reference: dto.ticketId,
            operatorId: operatorId,
          });
        }
      }

      const operator = await tx.user.findUnique({ where: { id: operatorId } });
      await this.movements.recordMany(
        tx,
        restoreMovements.map(m => ({
          ...m,
          operatorName: operator?.name ?? operator?.username,
        })),
      );

      // Update ticket status
      const updated = await tx.salesTicket.update({
        where: { id: dto.ticketId },
        data: { status: 'devuelto' },
        include: { items: true },
      });

      return { ok: true, ticket: updated, idempotent: false };
    }, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  // ============ Partial return by products (POS devoluciones) ============

  async returnItems(dto: ReturnItemsDto) {
    const operatorId = dto.operatorId ?? 'local';
    if (dto.idempotencyKey) {
      const existing = await this.prisma.salesTicket.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return { ok: true, ticket: existing, idempotent: true };
      }
    }

    const aggregated = aggregateSalesLineItems(dto.items);
    if (!aggregated.length) {
      throw new ConflictException('Return must include at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
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
      const salesProducts = await tx.salesProduct.findMany({
        where: { id: { in: salesProductIds }, active: true },
      });
      if (salesProducts.length !== salesProductIds.length) {
        throw new NotFoundException('One or more sales products not found or inactive');
      }
      const spMap = await loadSalesProductsForStock(tx, salesProductIds);
      const spMapForPricing = new Map(salesProducts.map(p => [p.id, p]));

      const counter = await tx.$queryRaw`
        SELECT COALESCE(MAX(number), 999) + 1 as next_num FROM "SalesTicket"
      ` as Array<{ next_num: number }>;
      const ticketNumber = counter[0].next_num;

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

      const ticket = await tx.salesTicket.create({
        data: {
          number: ticketNumber,
          status: 'devuelto',
          total,
          operatorId: operatorId,
          note: dto.note ?? 'Devolución parcial',
          idempotencyKey: dto.idempotencyKey,
          items: { create: ticketItems },
        },
        include: { items: true, operator: { select: { name: true, username: true } } },
      });

      await this.restoreStockForSalesItems(
        tx,
        aggregated,
        spMap,
        operatorId,
        ticket.id,
        'devolucion',
      );

      return { ok: true, ticket, idempotent: false };
    }, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
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
        SELECT id FROM "SalesTicket" WHERE id::text = ${ticketId} FOR UPDATE
      `;

      const ticket = await tx.salesTicket.findUnique({
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
      const salesProducts = await tx.salesProduct.findMany({
        where: { id: { in: allProductIds } },
      });
      const spMap = await loadSalesProductsForStock(tx, allProductIds);
      const spMapForPricing = new Map(salesProducts.map(p => [p.id, p]));

      const inactiveNew = newItems.filter(i => !salesProducts.find(p => p.id === i.salesProductId && p.active));
      if (inactiveNew.length > 0) {
        throw new ConflictException('One or more sales products not found or inactive');
      }

      const { sold, returned } = await this.getSoldAndReturnedByProduct(tx);
      const netOldItems = netRestoreQuantitiesAfterPartialReturns(
        ticket.items.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
        sold,
        returned,
      );

      await this.restoreStockForSalesItems(
        tx,
        netOldItems,
        spMap,
        operatorId,
        ticketId,
        'venta_anulada',
      );

      const requiredByStockProduct = buildRequiredByStockProduct(newItems, spMap);

      const stockProductIds = Object.keys(requiredByStockProduct);
      if (stockProductIds.length > 0) {
        const lockedLevels = await tx.$queryRaw`
          SELECT sl.*
          FROM "StockLevel" sl
          WHERE sl."productId"::text = ANY(${stockProductIds}::text[])
          FOR UPDATE
        ` as Array<{ productId: string; quantity: number; warehouseId: string }>;

        const availableByProduct: Record<string, number> = {};
        for (const level of lockedLevels) {
          availableByProduct[level.productId] = round3(
            (availableByProduct[level.productId] || 0) + Number(level.quantity),
          );
        }

        const missing: MissingStockItem[] = [];
        for (const [stockProductId, requiredQty] of Object.entries(requiredByStockProduct)) {
          const available = availableByProduct[stockProductId] || 0;
          if (available < requiredQty) {
            missing.push({ stockProductId, required: requiredQty, available });
          }
        }
        if (missing.length > 0) {
          throw new ConflictException({
            message: 'Insufficient stock for ticket update',
            missing,
          });
        }

        let remainingByProduct = { ...requiredByStockProduct };
        const movementEntries: Array<{
          type: 'venta';
          productId: string;
          warehouseId: string;
          quantity: number;
          reference: string;
          operatorId: string;
        }> = [];

        for (const level of lockedLevels) {
          const required = remainingByProduct[level.productId] || 0;
          if (required <= 0) continue;
          const deduction = round3(Math.min(Number(level.quantity), required));
          remainingByProduct[level.productId] = round3(remainingByProduct[level.productId] - deduction);
          await tx.$executeRaw`
            UPDATE "StockLevel" SET quantity = quantity - ${deduction}, "updatedAt" = NOW()
            WHERE "productId"::text = ${level.productId} AND "warehouseId"::text = ${level.warehouseId}
          `;
          movementEntries.push({
            type: 'venta',
            productId: level.productId,
            warehouseId: level.warehouseId,
            quantity: -deduction,
            reference: ticketId,
            operatorId: operatorId,
          });
        }

        const operator = await tx.user.findUnique({ where: { id: operatorId } });
        await this.movements.recordMany(
          tx,
          movementEntries.map(m => ({
            ...m,
            operatorName: operator?.name ?? operator?.username,
          })),
        );
      }

      await tx.salesTicketItem.deleteMany({ where: { ticketId } });

      let total = 0;
      const ticketItemRows: TicketItemData[] = [];
      for (const item of newItems) {
        const sp = spMapForPricing.get(item.salesProductId)!;
        total += Number(sp.price) * item.quantity;
        ticketItemRows.push({
          salesProductId: item.salesProductId,
          name: sp.name,
          unitPrice: sp.price,
          quantity: item.quantity,
        });
      }

      await tx.salesTicketItem.createMany({
        data: ticketItemRows.map(i => ({ ...i, ticketId })),
      });

      return tx.salesTicket.update({
        where: { id: ticketId },
        data: { total },
        include: { items: true, operator: { select: { username: true } } },
      });
    }, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  // ============ Stock helpers ============

  private async getSoldAndReturnedByProduct(tx: Prisma.TransactionClient): Promise<{
    sold: Record<string, number>;
    returned: Record<string, number>;
  }> {
    const tickets = await tx.salesTicket.findMany({
      where: { status: { in: ['emitido', 'devuelto'] } },
      include: { items: true },
    });
    const sold: Record<string, number> = {};
    const returned: Record<string, number> = {};
    for (const t of tickets) {
      if (t.status === 'emitido') {
        for (const item of t.items) {
          sold[item.salesProductId] = round3((sold[item.salesProductId] || 0) + item.quantity);
        }
      } else {
        for (const item of t.items) {
          returned[item.salesProductId] = round3((returned[item.salesProductId] || 0) + item.quantity);
        }
      }
    }
    return { sold, returned };
  }

  private async computeReturnableByProduct(
    tx: Prisma.TransactionClient,
  ): Promise<Record<string, number>> {
    const { sold, returned } = await this.getSoldAndReturnedByProduct(tx);
    return computeReturnableFromTotals(sold, returned);
  }

  private async restoreStockForSalesItems(
    tx: Prisma.TransactionClient,
    items: Array<{ salesProductId: string; quantity: number }>,
    spMap: Awaited<ReturnType<typeof loadSalesProductsForStock>>,
    operatorId: string,
    reference: string,
    movementType: 'devolucion' | 'venta_anulada',
  ): Promise<void> {
    const restoreByStockProduct = buildRequiredByStockProduct(items, spMap);

    const restoreMovements: Array<{
      type: typeof movementType;
      productId: string;
      warehouseId: string;
      quantity: number;
      reference: string;
      operatorId: string;
    }> = [];

    for (const [stockProductId, qty] of Object.entries(restoreByStockProduct)) {
      const levels = await tx.stockLevel.findMany({
        where: { productId: stockProductId },
        orderBy: { warehouseId: 'asc' },
      });
      if (levels.length > 0) {
        await tx.$executeRaw`
          UPDATE "StockLevel" SET quantity = quantity + ${qty}, "updatedAt" = NOW()
          WHERE id::text = ${levels[0].id}
        `;
        restoreMovements.push({
          type: movementType,
          productId: stockProductId,
          warehouseId: levels[0].warehouseId,
          quantity: qty,
          reference,
          operatorId,
        });
      }
    }

    if (restoreMovements.length > 0) {
      const operator = await tx.user.findUnique({ where: { id: operatorId } });
      await this.movements.recordMany(
        tx,
        restoreMovements.map(m => ({
          ...m,
          operatorName: operator?.name ?? operator?.username,
        })),
      );
    }
  }

  // ============ Sales Products CRUD ============

  async findAllSalesProducts() {
    return this.prisma.salesProduct.findMany({
      where: { active: true },
      include: SALES_PRODUCT_API_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findSalesProductById(id: string) {
    const product = await this.prisma.salesProduct.findUnique({
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
    const found = await this.prisma.salesProduct.findMany({
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
    name: string; category: string; kitchenId: string; price: number;
    emoji?: string; kind?: string;
    recipe?: { stockProductId: string; quantity: number }[];
    bundle?: { componentProductId: string; quantity: number }[];
  }) {
    const kind = data.kind === 'promo' ? 'promo' : 'simple';

    if (kind === 'promo') {
      await this.validatePromoBundle(undefined, data.bundle ?? []);
      return this.prisma.salesProduct.create({
        data: {
          name: data.name,
          category: data.category,
          kitchenId: data.kitchenId,
          price: data.price,
          emoji: data.emoji,
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

    return this.prisma.salesProduct.create({
      data: {
        name: data.name,
        category: data.category,
        kitchenId: data.kitchenId,
        price: data.price,
        emoji: data.emoji,
        kind: 'simple',
        recipe: { create: data.recipe ?? [] },
      },
      include: SALES_PRODUCT_API_INCLUDE,
    });
  }

  async updateSalesProduct(id: string, data: {
    name?: string; category?: string; kitchenId?: string;
    price?: number; emoji?: string; active?: boolean; kind?: string;
    recipe?: { stockProductId: string; quantity: number }[];
    bundle?: { componentProductId: string; quantity: number }[];
  }) {
    await this.findSalesProductById(id);

    return this.prisma.$transaction(async (tx) => {
      const { recipe, bundle, kind, ...productData } = data;
      const nextKind = kind === 'promo' ? 'promo' : kind === 'simple' ? 'simple' : undefined;

      if (nextKind === 'promo') {
        await this.validatePromoBundle(id, bundle ?? []);
      }

      await tx.salesProduct.update({
        where: { id },
        data: {
          ...productData,
          ...(nextKind ? { kind: nextKind } : {}),
        },
      });

      if (nextKind === 'promo') {
        await tx.recipeItem.deleteMany({ where: { salesProductId: id } });
        await tx.salesProductBundleItem.deleteMany({ where: { promoProductId: id } });
        if (bundle && bundle.length > 0) {
          await tx.salesProductBundleItem.createMany({
            data: bundle.map(b => ({
              promoProductId: id,
              componentProductId: b.componentProductId,
              quantity: b.quantity,
            })),
          });
        }
      } else if (nextKind === 'simple' || recipe !== undefined) {
        await tx.salesProductBundleItem.deleteMany({ where: { promoProductId: id } });
        await tx.recipeItem.deleteMany({ where: { salesProductId: id } });
        if (recipe && recipe.length > 0) {
          await tx.recipeItem.createMany({
            data: recipe.map(r => ({ salesProductId: id, ...r })),
          });
        }
        if (nextKind === 'simple') {
          await tx.salesProduct.update({ where: { id }, data: { kind: 'simple' } });
        }
      }

      return tx.salesProduct.findUnique({
        where: { id },
        include: SALES_PRODUCT_API_INCLUDE,
      });
    });
  }

  // ============ Tickets ============

  async findAllTickets(status?: string) {
    return this.prisma.salesTicket.findMany({
      where: status ? { status } : undefined,
      include: { items: true, operator: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findTicketById(id: string) {
    const ticket = await this.prisma.salesTicket.findUnique({
      where: { id },
      include: { items: true, kitchenOrders: true },
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return ticket;
  }

  async voidTicket(ticketId: string, operatorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "SalesTicket" WHERE id::text = ${ticketId} FOR UPDATE
      `;

      const ticket = await tx.salesTicket.findUnique({
        where: { id: ticketId },
        include: { items: true },
      });
      if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
      if (ticket.status !== 'emitido') throw new ConflictException('Can only void issued tickets');

      const productIds = [...new Set(ticket.items.map(i => i.salesProductId))];
      const spMap = await loadSalesProductsForStock(tx, productIds);

      const { sold, returned } = await this.getSoldAndReturnedByProduct(tx);
      const netItems = netRestoreQuantitiesAfterPartialReturns(
        ticket.items.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
        sold,
        returned,
      );

      await this.restoreStockForSalesItems(
        tx,
        netItems,
        spMap,
        operatorId,
        ticketId,
        'venta_anulada',
      );

      return tx.salesTicket.update({
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
    return this.prisma.kitchen.findMany({ orderBy: { name: 'asc' } });
  }

  async createKitchen(data: { name: string; emoji?: string }) {
    return this.prisma.kitchen.create({ data });
  }

  async updateKitchen(id: string, data: { name?: string; emoji?: string; active?: boolean }) {
    const existing = await this.prisma.kitchen.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Kitchen ${id} not found`);
    return this.prisma.kitchen.update({ where: { id }, data });
  }

  async deleteKitchen(id: string) {
    const existing = await this.prisma.kitchen.findUnique({
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
    return this.prisma.kitchen.delete({ where: { id } });
  }

  // ============ Tables ============

  async findAllTables() {
    return this.prisma.$queryRaw`
      SELECT id, name, 'libre' as status FROM "Warehouse" LIMIT 6
    `;
  }
}
