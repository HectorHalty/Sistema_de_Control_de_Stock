import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CheckoutDto, ReturnDto } from './dto';

interface MissingStockItem {
  stockProductId: string;
  required: number;
  available: number;
}

interface TicketItemData extends Omit<Prisma.SalesTicketItemUncheckedCreateWithoutTicketInput, 'createdAt'> {}

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  // ============ CRITICAL: Transactional Checkout ============
  // Uses Prisma interactive transactions with SELECT FOR UPDATE
  // to prevent race conditions on stock deduction.

  async checkout(dto: CheckoutDto) {
    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.salesTicket.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return { ok: true, ticket: existing, idempotent: true };
      }
    }

    // Validate sales products exist and are active
    const salesProductIds = [...new Set(dto.items.map(i => i.salesProductId))];
    const salesProducts = await this.prisma.salesProduct.findMany({
      where: { id: { in: salesProductIds }, active: true },
      include: { recipe: true },
    });

    if (salesProducts.length !== salesProductIds.length) {
      const found = new Set(salesProducts.map(p => p.id));
      const missing = salesProductIds.filter(id => !found.has(id));
      throw new NotFoundException(`Sales products not found or inactive: ${missing.join(', ')}`);
    }

    // Build required stock quantities by stock product ID
    const requiredByStockProduct: Record<string, number> = {};
    const salesProductMap = new Map(salesProducts.map(p => [p.id, p]));

    for (const item of dto.items) {
      const sp = salesProductMap.get(item.salesProductId);
      if (!sp) continue;
      for (const recipeItem of sp.recipe) {
        const key = recipeItem.stockProductId;
        requiredByStockProduct[key] = (requiredByStockProduct[key] || 0) + recipeItem.quantity * item.quantity;
      }
    }

    // Execute transaction with row-level locking
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock stock levels FOR UPDATE to prevent concurrent modification
      const stockProductIds = Object.keys(requiredByStockProduct);
      const lockedLevels = await tx.$queryRaw`
        SELECT sl.*, p.name as "productName"
        FROM "StockLevel" sl
        JOIN "Product" p ON p.id = sl."productId"
        WHERE sl."productId" = ANY(${stockProductIds}::uuid[])
        FOR UPDATE
      ` as Array<{ productId: string; quantity: number; warehouseId: string; productName: string }>;

      // Build available totals per stock product
      const availableByProduct: Record<string, number> = {};
      for (const level of lockedLevels) {
        availableByProduct[level.productId] = (availableByProduct[level.productId] || 0) + level.quantity;
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

      // Deduct stock atomically
      let remainingByProduct = { ...requiredByStockProduct };
      for (const level of lockedLevels) {
        const required = remainingByProduct[level.productId] || 0;
        if (required <= 0) continue;

        const deduction = Math.min(level.quantity, required);
        remainingByProduct[level.productId] -= deduction;

        // Use raw query for reliable composite key update
        await tx.$executeRaw`
          UPDATE "StockLevel" SET quantity = quantity - ${deduction}, "updatedAt" = NOW()
          WHERE "productId" = ${level.productId} AND "warehouseId" = ${level.warehouseId}
        `;
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
        const sp = salesProductMap.get(item.salesProductId)!;
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
          operatorId: dto.operatorId,
          note: dto.note,
          idempotencyKey: dto.idempotencyKey,
          items: { create: ticketItems },
        },
        include: { items: true },
      });

      // Create kitchen orders
      const kitchenGroups: Record<string, typeof ticketItems> = {};
      for (const item of ticketItems) {
        const sp = salesProductMap.get(item.salesProductId)!;
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
            operatorName: dto.operatorId, // simplified
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

      // Get sales products with recipes to restore stock
      const salesProductIds = [...new Set(ticket.items.map(i => i.salesProductId))];
      const salesProducts = await tx.salesProduct.findMany({
        where: { id: { in: salesProductIds } },
        include: { recipe: true },
      });
      const spMap = new Map(salesProducts.map(p => [p.id, p]));

      // Calculate stock to restore
      const restoreByStockProduct: Record<string, number> = {};
      for (const item of ticket.items) {
        const sp = spMap.get(item.salesProductId);
        if (!sp) continue;
        for (const recipeItem of sp.recipe) {
          const key = recipeItem.stockProductId;
          restoreByStockProduct[key] = (restoreByStockProduct[key] || 0) + recipeItem.quantity * item.quantity;
        }
      }

      // Restore stock atomically
      for (const [stockProductId, qty] of Object.entries(restoreByStockProduct)) {
        // Get all stock levels for this product and restore to first warehouse
        const levels = await tx.stockLevel.findMany({
          where: { productId: stockProductId },
          orderBy: { warehouseId: 'asc' },
        });

        if (levels.length > 0) {
          await tx.$executeRaw`
            UPDATE "StockLevel" SET quantity = quantity + ${qty}, "updatedAt" = NOW()
            WHERE id = ${levels[0].id}
          `;
        }
      }

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

  // ============ Sales Products CRUD ============

  async findAllSalesProducts() {
    return this.prisma.salesProduct.findMany({
      where: { active: true },
      include: { recipe: { include: { stockProduct: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findSalesProductById(id: string) {
    const product = await this.prisma.salesProduct.findUnique({
      where: { id },
      include: { recipe: { include: { stockProduct: true } } },
    });
    if (!product) throw new NotFoundException(`Sales product ${id} not found`);
    return product;
  }

  async createSalesProduct(data: {
    name: string; category: string; kitchenId: string; price: number;
    emoji?: string; recipe: { stockProductId: string; quantity: number }[];
  }) {
    return this.prisma.salesProduct.create({
      data: {
        name: data.name,
        category: data.category,
        kitchenId: data.kitchenId,
        price: data.price,
        emoji: data.emoji,
        recipe: { create: data.recipe },
      },
      include: { recipe: true },
    });
  }

  async updateSalesProduct(id: string, data: {
    name?: string; category?: string; kitchenId?: string;
    price?: number; emoji?: string; active?: boolean;
    recipe?: { stockProductId: string; quantity: number }[];
  }) {
    await this.findSalesProductById(id);

    return this.prisma.$transaction(async (tx) => {
      const { recipe, ...productData } = data;
      const product = await tx.salesProduct.update({
        where: { id },
        data: productData,
      });

      if (recipe) {
        // Replace recipe entirely
        await tx.recipeItem.deleteMany({ where: { salesProductId: id } });
        await tx.recipeItem.createMany({
          data: recipe.map(r => ({ salesProductId: id, ...r })),
        });
      }

      return tx.salesProduct.findUnique({
        where: { id },
        include: { recipe: { include: { stockProduct: true } } },
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
      const ticket = await tx.salesTicket.findUnique({
        where: { id: ticketId },
        include: { items: true },
      });
      if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
      if (ticket.status !== 'emitido') throw new ConflictException('Can only void issued tickets');

      // Restore stock (same as return)
      const salesProducts = await tx.salesProduct.findMany({
        where: { id: { in: ticket.items.map(i => i.salesProductId) } },
        include: { recipe: true },
      });
      const spMap = new Map(salesProducts.map(p => [p.id, p]));

      const restoreByStockProduct: Record<string, number> = {};
      for (const item of ticket.items) {
        const sp = spMap.get(item.salesProductId);
        if (!sp) continue;
        for (const recipeItem of sp.recipe) {
          const key = recipeItem.stockProductId;
          restoreByStockProduct[key] = (restoreByStockProduct[key] || 0) + recipeItem.quantity * item.quantity;
        }
      }

      for (const [stockProductId, qty] of Object.entries(restoreByStockProduct)) {
        const levels = await tx.stockLevel.findMany({
          where: { productId: stockProductId },
          orderBy: { warehouseId: 'asc' },
        });
        if (levels.length > 0) {
          await tx.$executeRaw`
            UPDATE "StockLevel" SET quantity = quantity + ${qty}, "updatedAt" = NOW() WHERE id = ${levels[0].id}
          `;
        }
      }

      return tx.salesTicket.update({
        where: { id: ticketId },
        data: { status: 'anulado' },
        include: { items: true },
      });
    });
  }

  // ============ Kitchens ============

  async findAllKitchens() {
    return this.prisma.kitchen.findMany({ orderBy: { name: 'asc' } });
  }

  async createKitchen(data: { name: string; emoji?: string }) {
    return this.prisma.kitchen.create({ data });
  }

  // ============ Tables ============

  async findAllTables() {
    return this.prisma.$queryRaw`
      SELECT id, name, 'libre' as status FROM "Warehouse" LIMIT 6
    `;
  }
}
