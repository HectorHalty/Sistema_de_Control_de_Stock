import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  CreateProductDto, UpdateProductDto, AdjustStockDto,
  CreateEmployeeConsumptionDto, CreateStockCountSessionDto,
  CreateSupplierDto, UpdateSupplierDto,
  CreatePurchaseOrderDto, ReceivePurchaseOrderDto,
} from './dto';
import { StockMovementsService } from './stock-movements.service';

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private movements: StockMovementsService,
  ) {}

  // Products
  async findAllProducts(categoryId?: string) {
    return this.prisma.producto.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: {
        category: true,
        stockLevels: { include: { warehouse: true } },
      },
      orderBy: { name: 'asc' },
    });
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
          unit: dto.unit || 'unidades',
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
    await this.findProductById(id); // throws if not found
    return this.prisma.producto.update({
      where: { id },
      data: dto,
      include: { stockLevels: { include: { warehouse: true } } },
    });
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
      // Find or create stock level for this product/warehouse
      let stockLevel = await tx.nivelStock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId: dto.warehouseId } },
      });

      if (!stockLevel) {
        stockLevel = await tx.nivelStock.create({
          data: { productId, warehouseId: dto.warehouseId, quantity: 0 },
        });
      }

      // Prisma devuelve Decimal como objeto; lo paso a number para la aritmética
      // y redondeo a 3 decimales para evitar derivas de punto flotante.
      const current = Number(stockLevel.quantity);
      const newQuantity = Math.round((current + dto.quantity) * 1000) / 1000;
      if (newQuantity < 0) {
        throw new ConflictException(
          `Insufficient stock: would go from ${current} to ${newQuantity}`,
        );
      }

      const updated = await tx.nivelStock.update({
        where: { id: stockLevel.id },
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

      const previousStock = Number(stockLevel.quantity);
      const qty = Math.round(dto.quantity * 1000) / 1000;
      const newStock = Math.round((previousStock - qty) * 1000) / 1000;
      if (newStock < 0) {
        throw new ConflictException(
          `Insufficient stock: available ${previousStock}, requested ${qty}`,
        );
      }

      await tx.nivelStock.update({
        where: { id: stockLevel.id },
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

  findAllSuppliers() {
    return this.prisma.proveedor.findMany({
      include: { products: true },
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.proveedor.create({
      data: {
        name: dto.name,
        products: dto.productIds?.length
          ? { create: dto.productIds.map(productId => ({ productId })) }
          : undefined,
      },
      include: { products: true },
    });
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

  findAllPurchaseOrders(status?: string) {
    return this.prisma.ordenCompra.findMany({
      where: status ? { status } : undefined,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
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

  async receivePurchaseOrder(idOrNumber: string, dto: ReceivePurchaseOrderDto) {
    const order = await this.prisma.ordenCompra.findFirst({
      where: { OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Purchase order ${idOrNumber} not found`);
    if (order.status === 'Recibido') {
      throw new ConflictException('El pedido ya fue recibido');
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

  async createWarehouse(dto: { name: string; location: string; icon?: string }) {
    return this.prisma.deposito.create({ data: dto });
  }

  async updateWarehouse(id: string, dto: { name?: string; location?: string; icon?: string }) {
    const existing = await this.prisma.deposito.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Warehouse ${id} not found`);
    return this.prisma.deposito.update({ where: { id }, data: dto });
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

  async createCategory(dto: { name: string; icon?: string }) {
    return this.prisma.categoria.create({ data: dto });
  }

  async updateCategory(id: string, dto: { name?: string; icon?: string }) {
    const existing = await this.prisma.categoria.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Category ${id} not found`);
    return this.prisma.categoria.update({ where: { id }, data: dto });
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
