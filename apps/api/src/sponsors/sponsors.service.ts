import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SponsorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(active?: boolean, placement?: string) {
    return this.prisma.patrocinador.findMany({
      where: {
        ...(active !== undefined ? { active } : {}),
        ...(placement ? { placement } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const sponsor = await this.prisma.patrocinador.findUnique({ where: { id } });
    if (!sponsor) throw new NotFoundException(`Sponsor ${id} not found`);
    return sponsor;
  }

  async create(data: { name: string; imageUrl: string; placement?: string; linkUrl?: string }) {
    return this.prisma.patrocinador.create({
      data: {
        name: data.name,
        imageUrl: data.imageUrl,
        placement: data.placement || 'banner',
        linkUrl: data.linkUrl,
        active: true,
      },
    });
  }

  async update(id: string, data: { name?: string; imageUrl?: string; placement?: string; active?: boolean; linkUrl?: string }) {
    await this.findById(id);
    return this.prisma.patrocinador.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.patrocinador.delete({ where: { id } });
  }
}
