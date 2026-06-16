import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateProductDto, UpdateProductDto, AdjustStockDto } from './dto';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  // Products
  async findAllProducts(categoryId?: string) {
    return this.prisma.product.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: {
        category: true,
        stockLevels: { include: { warehouse: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findProductById(id: string) {
    const product = await this.prisma.product.findUnique({
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
      const product = await tx.product.create({
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
        await tx.stockLevel.create({
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
    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: { stockLevels: { include: { warehouse: true } } },
    });
  }

  async deleteProduct(id: string) {
    await this.findProductById(id);
    return this.prisma.product.delete({ where: { id } });
  }

  // Stock levels
  async getStockLevels(productId: string) {
    await this.findProductById(productId);
    return this.prisma.stockLevel.findMany({
      where: { productId },
      include: { warehouse: true },
    });
  }

  async adjustStock(productId: string, dto: AdjustStockDto) {
    return this.prisma.$transaction(async (tx) => {
      // Find or create stock level for this product/warehouse
      let stockLevel = await tx.stockLevel.findUnique({
        where: { productId_warehouseId: { productId, warehouseId: dto.warehouseId } },
      });

      if (!stockLevel) {
        stockLevel = await tx.stockLevel.create({
          data: { productId, warehouseId: dto.warehouseId, quantity: 0 },
        });
      }

      const newQuantity = stockLevel.quantity + dto.quantity;
      if (newQuantity < 0) {
        throw new ConflictException(
          `Insufficient stock: would go from ${stockLevel.quantity} to ${newQuantity}`,
        );
      }

      return tx.stockLevel.update({
        where: { id: stockLevel.id },
        data: { quantity: newQuantity },
        include: { warehouse: true },
      });
    });
  }

  // Warehouses
  async findAllWarehouses() {
    return this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
  }

  async createWarehouse(dto: { name: string; location: string; icon?: string }) {
    return this.prisma.warehouse.create({ data: dto });
  }

  async updateWarehouse(id: string, dto: { name?: string; location?: string; icon?: string }) {
    const existing = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Warehouse ${id} not found`);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async deleteWarehouse(id: string) {
    const existing = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Warehouse ${id} not found`);
    return this.prisma.warehouse.delete({ where: { id } });
  }

  // Categories
  async findAllCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async createCategory(dto: { name: string; icon?: string }) {
    return this.prisma.category.create({ data: dto });
  }

  async updateCategory(id: string, dto: { name?: string; icon?: string }) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Category ${id} not found`);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) throw new NotFoundException(`Category ${id} not found`);
    if (existing._count.products > 0) {
      throw new ConflictException(
        `No se puede eliminar la categoría: tiene ${existing._count.products} producto(s) asociado(s).`,
      );
    }
    return this.prisma.category.delete({ where: { id } });
  }

  // Internal helpers
  private async getDefaultWarehouse(tx: any): Promise<string> {
    const wh = await tx.warehouse.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!wh) throw new ConflictException('No warehouses configured. Create one first.');
    return wh.id;
  }
}
