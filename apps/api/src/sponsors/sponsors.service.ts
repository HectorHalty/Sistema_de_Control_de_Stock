import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SponsorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(active?: boolean, placement?: string) {
    return this.prisma.sponsor.findMany({
      where: {
        ...(active !== undefined ? { active } : {}),
        ...(placement ? { placement } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const sponsor = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) throw new NotFoundException(`Sponsor ${id} not found`);
    return sponsor;
  }

  async create(data: { name: string; imageUrl: string; placement?: string; linkUrl?: string }) {
    return this.prisma.sponsor.create({
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
    return this.prisma.sponsor.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.sponsor.delete({ where: { id } });
  }
}
