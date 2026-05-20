import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class OnlineCatalogService {
  constructor(private prisma: PrismaService) {}

  async findAll(active?: boolean, category?: string) {
    return this.prisma.onlineProduct.findMany({
      where: {
        ...(active !== undefined ? { active } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const product = await this.prisma.onlineProduct.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Online product ${id} not found`);
    return product;
  }

  async create(data: {
    name: string; description?: string; price: number; image?: string;
    images?: string[]; category: string; attributes?: Record<string, any>;
    stockProductId?: string;
  }) {
    return this.prisma.onlineProduct.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        image: data.image,
        images: data.images || [],
        category: data.category,
        attributes: data.attributes ? JSON.parse(JSON.stringify(data.attributes)) : undefined,
        stockProductId: data.stockProductId,
        active: true,
      },
    });
  }

  async update(id: string, data: {
    name?: string; description?: string; price?: number; image?: string;
    images?: string[]; category?: string; attributes?: Record<string, any>;
    active?: boolean; stockProductId?: string;
  }) {
    await this.findById(id);
    const { attributes, ...rest } = data;
    return this.prisma.onlineProduct.update({
      where: { id },
      data: {
        ...rest,
        ...(attributes ? { attributes: JSON.parse(JSON.stringify(attributes)) } : {}),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.onlineProduct.delete({ where: { id } });
  }
}
