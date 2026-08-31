import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SalesService } from '../sales/sales.service';

@Injectable()
export class OnlineService {
  constructor(
    private prisma: PrismaService,
    private sales: SalesService,
  ) {}

  async getOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayOrders, activeKitchen, topItems] = await Promise.all([
      this.prisma.pedidoPublico.aggregate({
        _count: true,
        _sum: { total: true },
        where: { status: { not: 'cancelado' } },
      }),
      this.prisma.pedidoPublico.aggregate({
        _count: true,
        _sum: { total: true },
        where: {
          createdAt: { gte: today },
          status: { in: ['pagado', 'en_cocina', 'listo', 'retirado'] },
        },
      }),
      this.prisma.ordenCocina.count({
        where: {
          pedidoPublicoId: { not: null },
          status: { not: 'delivered' },
        },
      }),
      this.prisma.itemPedidoPublico.groupBy({
        by: ['name'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const menuVisible = await this.prisma.productoVenta.count({
      where: { active: true, visibleWeb: true },
    });

    return {
      pedidosTotal: total._count,
      recaudacionTotal: Number(total._sum.total ?? 0),
      pedidosHoy: todayOrders._count,
      recaudacionHoy: Number(todayOrders._sum.total ?? 0),
      cocinaActivos: activeKitchen,
      menuVisible,
      topItems: topItems.map((i) => ({
        name: i.name,
        quantity: i._sum.quantity ?? 0,
      })),
    };
  }

  async getMetrics(from?: string, to?: string) {
    const where: { createdAt?: { gte?: Date; lte?: Date }; status?: object } = {
      status: { not: 'cancelado' },
    };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [orders, byStatus, pedidos] = await Promise.all([
      this.prisma.pedidoPublico.aggregate({
        _count: true,
        _sum: { total: true },
        where,
      }),
      this.prisma.pedidoPublico.groupBy({
        by: ['status'],
        _count: true,
        where,
      }),
      this.prisma.pedidoPublico.findMany({
        where,
        include: { items: true },
      }),
    ]);

    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const pedido of pedidos) {
      for (const row of pedido.items) {
        const prev = itemMap.get(row.name) ?? { name: row.name, quantity: 0, revenue: 0 };
        prev.quantity += row.quantity;
        prev.revenue += row.quantity * Number(row.unitPrice);
        itemMap.set(row.name, prev);
      }
    }

    const topByRevenue = [...itemMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalPedidos: orders._count,
      recaudacion: Number(orders._sum.total ?? 0),
      porEstado: byStatus.map((s) => ({ status: s.status, count: s._count })),
      topItems: topByRevenue,
    };
  }

  async listOrders(status?: string, limit = 50) {
    return this.prisma.pedidoPublico.findMany({
      where: status ? { status } : undefined,
      include: {
        items: true,
        tokenRetiro: { select: { token: true, usadoEn: true } },
        ticketVenta: { select: { number: true } },
        cuentaPublica: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listWebMenu(visibleOnly?: boolean) {
    return this.prisma.productoVenta.findMany({
      where: {
        active: true,
        ...(visibleOnly ? { visibleWeb: true } : {}),
      },
      include: { kitchen: { select: { id: true, name: true, emoji: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async updateWebMenu(
    id: string,
    data: {
      visibleWeb?: boolean;
      descripcionWeb?: string | null;
      imagenWeb?: string | null;
      emoji?: string | null;
      price?: number;
    },
  ) {
    const product = await this.prisma.productoVenta.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.productoVenta.update({
      where: { id },
      data: {
        visibleWeb: data.visibleWeb,
        descripcionWeb: data.descripcionWeb,
        imagenWeb: data.imagenWeb,
        emoji: data.emoji ?? undefined,
        price: data.price,
      },
      include: { kitchen: { select: { id: true, name: true, emoji: true } } },
    });
  }

  redeemQr(token: string, operatorId: string) {
    return this.sales.redeemPublicQr(token, operatorId);
  }
}
