import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { EstadoOrdenCompra, Prisma, UnidadMedida } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateProductDto, UpdateProductDto, AdjustStockDto,
  CreateEmployeeConsumptionDto, CreateStockCountSessionDto,
  CreateSupplierDto, UpdateSupplierDto,
  CreatePurchaseOrderDto, UpdatePurchaseOrderDto, ReceivePurchaseOrderDto,
  CreateCategoryDto, UpdateCategoryDto, CreateWarehouseDto, UpdateWarehouseDto,
} from './dto';
import { StockMovementsService } from './stock-movements.service';
import { isPrismaUniqueConflict } from '../common/prisma-errors';
import { assertVersionedUpdateApplied } from '../common/optimistic-lock';
import { normalizeLimit, toCursorPage, type CursorPage } from '../common/pagination';

/** Valores del enum, para descartar filtros inválidos sin consultar la base. */
const ESTADOS_ORDEN_VALIDOS = new Set<string>(Object.values(EstadoOrdenCompra));

// Tipos de retorno explícitos para los listados paginables (Task 9): sin
// overloads, TS infiere el tipo unión `T[] | CursorPage<T>` para TODOS los
// callers, incluidos los que no piden paginación.
type ProductWithLevels = Prisma.ProductoGetPayload<{
  include: { category: true; stockLevels: { include: { warehouse: true } } };
}>;
type SupplierWithProducts = Prisma.ProveedorGetPayload<{ include: { products: true } }>;
type PurchaseOrderWithItems = Prisma.OrdenCompraGetPayload<{ include: { items: true } }>;

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private movements: StockMovementsService,
  ) {}

  // Products
  /**
   * Sin `cursor`/`limit`: devuelve el array completo (compatibilidad con
   * clientes que todavía no piden paginación). Con cualquiera de los dos,
   * devuelve `{ items, nextCursor }` — ver Task 9/10 de
   * docs/superpowers/plans/2026-09-07-integridad-operacional-b.md.
   */
  async findAllProducts(categoryId?: string): Promise<ProductWithLevels[]>;
  async findAllProducts(categoryId: string | undefined, cursor: string | undefined, limit: number | undefined): Promise<CursorPage<ProductWithLevels>>;
  async findAllProducts(categoryId?: string, cursor?: string, limit?: number) {
    const include = { category: true, stockLevels: { include: { warehouse: true } } } as const;
    const where = categoryId ? { categoryId } : undefined;

    if (cursor === undefined && limit === undefined) {
      return this.prisma.producto.findMany({ where, include, orderBy: { name: 'asc' } });
    }

    const take = normalizeLimit(limit);
    const rows = await this.prisma.producto.findMany({
      where,
      include,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    return toCursorPage(rows, take);
  }

  async findProductById(id: string) {
    const product = await this.prisma.producto.findUnique({
      where: { id },
      include: {
        category: true,
        stockLevels: { include: { warehouse: true } },
        recipeItems: { include: { salesProduct: true } },
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.producto.create({
        data: {
          name: dto.name,
          code: dto.code,
          description: dto.description,
          categoryId: dto.categoryId,
          unit: dto.unit ?? UnidadMedida.unidades,
          orderUnit: dto.orderUnit,
          image: dto.image,
        },
        include: { stockLevels: true },
      });

      // Set initial stock if provided
      if (dto.initialStock && dto.initialStock > 0) {
        const warehouseId = dto.warehouseId || (await this.getDefaultWarehouse(tx));
        await tx.nivelStock.create({
          data: {
            productId: product.id,
            warehouseId,
            quantity: dto.initialStock,
          },
        });
      }

      return product;
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.findProductById(id);
    const data = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.orderUnit !== undefined ? { orderUnit: dto.orderUnit } : {}),
      ...(dto.image !== undefined ? { image: dto.image } : {}),
    };

    if (dto.version !== undefined) {
      const { count } = await this.prisma.producto.updateMany({
        where: { id, version: dto.version },
        data: { ...data, version: { increment: 1 } },
      });
      assertVersionedUpdateApplied(count);
    } else {
      await this.prisma.producto.update({ where: { id }, data });
    }

    const result = await this.prisma.producto.findUnique({
      where: { id },
      include: { stockLevels: { include: { warehouse: true } } },
    });
    if (!result) throw new NotFoundException(`Product ${id} not found`);
    return result;
  }

  async deleteProduct(id: string) {
    await this.findProductById(id);
    return this.prisma.producto.delete({ where: { id } });
  }

  // Stock levels
  async getStockLevels(productId: string) {
    await this.findProductById(productId);
    return this.prisma.nivelStock.findMany({
      where: { productId },
      include: { warehouse: true },
    });
  }

  async adjustStock(productId: string, dto: AdjustStockDto) {
    return this.prisma.$transaction(async (tx) => {
      let stockLevel = await tx.nivelStock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId: dto.warehouseId } },
      });

      if (!stockLevel) {
        stockLevel = await tx.nivelStock.create({
          data: { productId, warehouseId: dto.warehouseId, quantity: 0 },
        });
      }

      await tx.$queryRaw`
        SELECT id FROM "niveles_stock" WHERE id::text = ${stockLevel.id} FOR UPDATE
      `;
      const locked = await tx.nivelStock.findUnique({ where: { id: stockLevel.id } });
      if (!locked) throw new NotFoundException(`Stock level ${stockLevel.id} not found`);

      const current = Number(locked.quantity);
      const newQuantity = Math.round((current + dto.quantity) * 1000) / 1000;
      if (newQuantity < 0) {
        throw new ConflictException(
          `Insufficient stock: would go from ${current} to ${newQuantity}`,
        );
      }

      const updated = await tx.nivelStock.update({
        where: { id: locked.id },
        data: { quantity: newQuantity },
        include: { warehouse: true },
      });

      await this.movements.recordMany(tx, [{
        type: 'ajuste_manual',
        productId,
        warehouseId: dto.warehouseId,
        quantity: dto.quantity,
        reference: dto.reference,
        operatorId: dto.operatorId,
        operatorName: dto.operatorName,
      }]);

      return updated;
    });
  }

  // ============ Stock movements (read) ============

  findAllMovements(filters?: {
    productId?: string;
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    return this.movements.findAll(filters);
  }

  // ============ Employee consumption ============

  async createEmployeeConsumption(dto: CreateEmployeeConsumptionDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.producto.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException(`Product ${dto.productId} not found`);

      const warehouse = await tx.deposito.findUnique({ where: { id: dto.warehouseId } });
      if (!warehouse) throw new NotFoundException(`Warehouse ${dto.warehouseId} not found`);

      let stockLevel = await tx.nivelStock.findUnique({
        where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId } },
      });
      if (!stockLevel) {
        stockLevel = await tx.nivelStock.create({
          data: { productId: dto.productId, warehouseId: dto.warehouseId, quantity: 0 },
        });
      }

      await tx.$queryRaw`
        SELECT id FROM "niveles_stock" WHERE id::text = ${stockLevel.id} FOR UPDATE
      `;
      const locked = await tx.nivelStock.findUnique({ where: { id: stockLevel.id } });
      if (!locked) throw new NotFoundException(`Stock level ${stockLevel.id} not found`);

      const previousStock = Number(locked.quantity);
      const qty = Math.round(dto.quantity * 1000) / 1000;
      const newStock = Math.round((previousStock - qty) * 1000) / 1000;
      if (newStock < 0) {
        throw new ConflictException(
          `Insufficient stock: available ${previousStock}, requested ${qty}`,
        );
      }

      await tx.nivelStock.update({
        where: { id: locked.id },
        data: { quantity: newStock },
      });

      const day = new Date().toISOString().slice(0, 10);
      const entry = await tx.consumoEmpleado.create({
        data: {
          day,
          productId: dto.productId,
          productName: product.name,
          productCode: product.code,
          warehouseId: dto.warehouseId,
          warehouseName: warehouse.name,
          quantity: qty,
          unit: product.unit,
          previousStock,
          newStock,
          operatorId: dto.operatorId,
          operatorName: dto.operatorName,
          operatorRole: dto.operatorRole,
          note: dto.note,
        },
      });

      await this.movements.recordMany(tx, [{
        type: 'consumo',
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        quantity: -qty,
        reference: entry.id,
        operatorId: dto.operatorId,
        operatorName: dto.operatorName,
      }]);

      return entry;
    });
  }

  findAllEmployeeConsumptions(limit = 200) {
    return this.prisma.consumoEmpleado.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ============ Stock count sessions ============

  async createStockCountSession(dto: CreateStockCountSessionDto) {
    return this.prisma.sesionConteo.create({
      data: {
        date: dto.date,
        dateType: dto.dateType ?? 'regular',
        operatorId: dto.operatorId,
        operatorName: dto.operatorName,
        entries: {
          create: dto.entries.map(e => ({
            productId: e.productId,
            productName: e.productName,
            unit: e.unit,
            expected: e.expected,
            counted: e.counted,
          })),
        },
      },
      include: { entries: true },
    });
  }

  findAllStockCountSessions(limit = 100) {
    return this.prisma.sesionConteo.findMany({
      include: { entries: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ============ Suppliers ============

  /** Sin cursor/limit: array completo. Con alguno: `{ items, nextCursor }` — ver Task 9. */
  async findAllSuppliers(): Promise<SupplierWithProducts[]>;
  async findAllSuppliers(cursor: string | undefined, limit: number | undefined): Promise<CursorPage<SupplierWithProducts>>;
  async findAllSuppliers(cursor?: string, limit?: number) {
    if (cursor === undefined && limit === undefined) {
      return this.prisma.proveedor.findMany({ include: { products: true }, orderBy: { name: 'asc' } });
    }
    const take = normalizeLimit(limit);
    const rows = await this.prisma.proveedor.findMany({
      include: { products: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    return toCursorPage(rows, take);
  }

  async createSupplier(dto: CreateSupplierDto) {
    try {
      return await this.prisma.proveedor.create({
        data: {
          name: dto.name,
          products: dto.productIds?.length
            ? { create: dto.productIds.map(productId => ({ productId })) }
            : undefined,
        },
        include: { products: true },
      });
    } catch (e) {
      if (isPrismaUniqueConflict(e)) {
        throw new ConflictException(`Ya existe un proveedor con el nombre "${dto.name}"`);
      }
      throw e;
    }
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const existing = await this.prisma.proveedor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Supplier ${id} not found`);

    return this.prisma.$transaction(async (tx) => {
      if (dto.productIds !== undefined) {
        await tx.proveedorProducto.deleteMany({ where: { supplierId: id } });
        if (dto.productIds.length > 0) {
          await tx.proveedorProducto.createMany({
            data: dto.productIds.map(productId => ({ supplierId: id, productId })),
          });
        }
      }
      return tx.proveedor.update({
        where: { id },
        data: { name: dto.name },
        include: { products: true },
      });
    });
  }

  async deleteSupplier(id: string) {
    const existing = await this.prisma.proveedor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Supplier ${id} not found`);
    return this.prisma.proveedor.delete({ where: { id } });
  }

  // ============ Purchase orders ============

  /** Sin cursor/limit: array completo. Con alguno: `{ items, nextCursor }` — ver Task 9. */
  async findAllPurchaseOrders(status?: string): Promise<PurchaseOrderWithItems[]>;
  async findAllPurchaseOrders(status: string | undefined, cursor: string | undefined, limit: number | undefined): Promise<CursorPage<PurchaseOrderWithItems>>;
  async findAllPurchaseOrders(status?: string, cursor?: string, limit?: number) {
    // Un estado fuera del enum no matchea ninguna fila; se responde vacío en vez
    // de dejar que Prisma rechace el valor.
    if (status && !ESTADOS_ORDEN_VALIDOS.has(status)) {
      return cursor === undefined && limit === undefined ? [] : { items: [], nextCursor: null };
    }
    const where = status ? { status: status as EstadoOrdenCompra } : undefined;
    if (cursor === undefined && limit === undefined) {
      return this.prisma.ordenCompra.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' } });
    }
    const take = normalizeLimit(limit);
    const rows = await this.prisma.ordenCompra.findMany({
      where,
      include: { items: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    return toCursorPage(rows, take);
  }

  async findPurchaseOrderById(id: string) {
    const order = await this.prisma.ordenCompra.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Purchase order ${id} not found`);
    return order;
  }

  async findPurchaseOrderByNumber(orderNumber: string) {
    return this.findPurchaseOrderById(orderNumber);
  }

  private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    await tx.contadorPedido.upsert({
      where: { id: 'default' },
      create: { id: 'default', valor: 0 },
      update: {},
    });
    const updated = await tx.contadorPedido.update({
      where: { id: 'default' },
      data: { valor: { increment: 1 } },
    });
    return `PED-${String(updated.valor).padStart(3, '0')}`;
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    if (!dto.items.length) {
      throw new ConflictException('El pedido debe tener al menos un ítem');
    }

    return this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.nextOrderNumber(tx);
      const date = new Date().toISOString().slice(0, 10);

      let provider = dto.provider;
      if (dto.supplierId) {
        const supplier = await tx.proveedor.findUnique({ where: { id: dto.supplierId } });
        if (!supplier) throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
        provider = supplier.name;
      }

      return tx.ordenCompra.create({
        data: {
          orderNumber,
          date,
          provider,
          supplierId: dto.supplierId ?? null,
          status: 'Pendiente',
          items: {
            create: dto.items.map(i => ({
              productId: i.productId,
              quantityOrdered: i.quantityOrdered,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async updatePurchaseOrder(id: string, dto: UpdatePurchaseOrderDto) {
    const order = await this.findPurchaseOrderById(id);
    if (order.status === 'Recibido') {
      throw new ConflictException('No se puede editar un pedido ya recibido');
    }
    if (dto.items && dto.items.length === 0) {
      throw new ConflictException('El pedido debe tener al menos un ítem');
    }

    return this.prisma.$transaction(async (tx) => {
      let provider = dto.provider;
      if (dto.supplierId) {
        const supplier = await tx.proveedor.findUnique({ where: { id: dto.supplierId } });
        if (!supplier) throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
        provider = provider ?? supplier.name;
      }

      if (dto.items) {
        const nextIds = dto.items.map(i => i.productId);
        await tx.itemOrdenCompra.deleteMany({
          where: { purchaseOrderId: order.id, productId: { notIn: nextIds } },
        });
        for (const item of dto.items) {
          await tx.itemOrdenCompra.upsert({
            where: {
              purchaseOrderId_productId: {
                purchaseOrderId: order.id,
                productId: item.productId,
              },
            },
            create: {
              purchaseOrderId: order.id,
              productId: item.productId,
              quantityOrdered: item.quantityOrdered,
            },
            update: { quantityOrdered: item.quantityOrdered },
          });
        }
      }

      const data = {
        ...(provider !== undefined ? { provider } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
      };

      if (dto.version !== undefined) {
        const { count } = await tx.ordenCompra.updateMany({
          where: { id: order.id, version: dto.version },
          data: { ...data, version: { increment: 1 } },
        });
        assertVersionedUpdateApplied(count);
      } else {
        await tx.ordenCompra.update({ where: { id: order.id }, data });
      }

      const result = await tx.ordenCompra.findUnique({ where: { id: order.id }, include: { items: true } });
      if (!result) throw new NotFoundException(`Purchase order ${order.id} not found`);
      return result;
    });
  }

  async receivePurchaseOrder(idOrNumber: string, dto: ReceivePurchaseOrderDto) {
    const order = await this.prisma.ordenCompra.findFirst({
      where: { OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Purchase order ${idOrNumber} not found`);
    if (order.status === 'Recibido') {
      throw new ConflictException('El pedido ya fue recibido');
    }

    const receivedIds = new Set(dto.items.map(i => i.productId));
    const unknown = dto.items.filter(i => !order.items.some(line => line.productId === i.productId));
    if (unknown.length > 0) {
      throw new NotFoundException(`Product ${unknown[0].productId} not in order`);
    }
    const missing = order.items.filter(i => !receivedIds.has(i.productId));
    if (missing.length > 0) {
      throw new ConflictException('La recepción debe incluir todos los productos del pedido');
    }

    return this.prisma.$transaction(async (tx) => {
      const receivedAt = new Date();
      const movementEntries: {
        type: 'entrada';
        productId: string;
        warehouseId: string;
        quantity: number;
        reference: string;
        operatorId?: string;
        operatorName?: string;
      }[] = [];

      for (const recv of dto.items) {
        const line = order.items.find(i => i.productId === recv.productId);
        if (!line) {
          throw new NotFoundException(`Product ${recv.productId} not in order`);
        }

        const allocSum = recv.allocations.reduce((s, a) => s + a.quantity, 0);
        const qtyReceived = Math.round(recv.quantityReceived * 1000) / 1000;
        const ordered = Math.round(Number(line.quantityOrdered) * 1000) / 1000;
        if (qtyReceived > ordered) {
          throw new ConflictException(
            `La cantidad recibida de ${recv.productId} (${qtyReceived}) supera lo pedido (${ordered})`,
          );
        }
        if (Math.round(allocSum * 1000) / 1000 !== qtyReceived) {
          throw new ConflictException(
            `Allocations for product ${recv.productId} must sum to ${qtyReceived}`,
          );
        }

        await tx.itemOrdenCompra.update({
          where: { id: line.id },
          data: { quantityReceived: qtyReceived },
        });

        for (const alloc of recv.allocations) {
          if (alloc.quantity <= 0) continue;

          let stockLevel = await tx.nivelStock.findUnique({
            where: {
              productId_warehouseId: {
                productId: recv.productId,
                warehouseId: alloc.warehouseId,
              },
            },
          });
          if (!stockLevel) {
            stockLevel = await tx.nivelStock.create({
              data: {
                productId: recv.productId,
                warehouseId: alloc.warehouseId,
                quantity: 0,
              },
            });
          }

          const current = Number(stockLevel.quantity);
          const delta = Math.round(alloc.quantity * 1000) / 1000;
          const newQuantity = Math.round((current + delta) * 1000) / 1000;

          await tx.nivelStock.update({
            where: { id: stockLevel.id },
            data: { quantity: newQuantity },
          });

          movementEntries.push({
            type: 'entrada',
            productId: recv.productId,
            warehouseId: alloc.warehouseId,
            quantity: delta,
            reference: order.orderNumber,
            operatorId: dto.operatorId,
            operatorName: dto.operatorName,
          });
        }
      }

      await this.movements.recordMany(tx, movementEntries);

      const fullyReceived = order.items.every(line => {
        const recv = dto.items.find(i => i.productId === line.productId);
        if (!recv) return false;
        return Math.round(recv.quantityReceived * 1000) / 1000
          >= Math.round(Number(line.quantityOrdered) * 1000) / 1000;
      });
      if (!fullyReceived) {
        throw new ConflictException(
          'La recepción es parcial: confirmá todas las cantidades pedidas o editá el pedido antes de recibir',
        );
      }

      return tx.ordenCompra.update({
        where: { id: order.id },
        data: { status: 'Recibido', receivedAt },
        include: { items: true },
      });
    });
  }

  // Warehouses
  async findAllWarehouses() {
    return this.prisma.deposito.findMany({ orderBy: { name: 'asc' } });
  }

  async createWarehouse(dto: CreateWarehouseDto) {
    try {
      return await this.prisma.deposito.create({
        data: {
          name: dto.name,
          location: dto.location,
          icon: dto.icon,
        },
      });
    } catch (e) {
      if (isPrismaUniqueConflict(e)) {
        throw new ConflictException(`Ya existe un almacén con el nombre "${dto.name}"`);
      }
      throw e;
    }
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto) {
    const existing = await this.prisma.deposito.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Warehouse ${id} not found`);
    try {
      return await this.prisma.deposito.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.location !== undefined ? { location: dto.location } : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        },
      });
    } catch (e) {
      if (isPrismaUniqueConflict(e)) {
        throw new ConflictException(`Ya existe un almacén con el nombre "${dto.name}"`);
      }
      throw e;
    }
  }

  async deleteWarehouse(id: string) {
    const existing = await this.prisma.deposito.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Warehouse ${id} not found`);
    // StockLevel tiene onDelete: Cascade — no hace falta borrar niveles a mano.
    return this.prisma.deposito.delete({ where: { id } });
  }

  // Categories
  async findAllCategories() {
    return this.prisma.categoria.findMany({ orderBy: { name: 'asc' } });
  }

  async createCategory(dto: CreateCategoryDto) {
    try {
      return await this.prisma.categoria.create({
        data: {
          name: dto.name,
          icon: dto.icon ?? 'Package',
        },
      });
    } catch (e) {
      if (isPrismaUniqueConflict(e)) {
        const existing = await this.prisma.categoria.findUnique({ where: { name: dto.name } });
        if (existing) {
          if (dto.icon && dto.icon !== existing.icon) {
            return this.prisma.categoria.update({
              where: { id: existing.id },
              data: { icon: dto.icon },
            });
          }
          return existing;
        }
        throw new ConflictException(`Ya existe una categoría con el nombre "${dto.name}"`);
      }
      throw e;
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.categoria.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Category ${id} not found`);
    try {
      return await this.prisma.categoria.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        },
      });
    } catch (e) {
      if (isPrismaUniqueConflict(e)) {
        throw new ConflictException(`Ya existe una categoría con el nombre "${dto.name}"`);
      }
      throw e;
    }
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.categoria.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) throw new NotFoundException(`Category ${id} not found`);
    if (existing._count.products > 0) {
      throw new ConflictException(
        `No se puede eliminar la categoría: tiene ${existing._count.products} producto(s) asociado(s).`,
      );
    }
    return this.prisma.categoria.delete({ where: { id } });
  }

  // Internal helpers
  private async getDefaultWarehouse(tx: any): Promise<string> {
    const wh = await tx.deposito.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!wh) throw new ConflictException('No warehouses configured. Create one first.');
    return wh.id;
  }
}
