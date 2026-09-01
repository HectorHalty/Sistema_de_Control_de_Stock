import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SalesService } from '../sales/sales.service';
import { normalizeQrToken } from './qr-token.util';

const WEB_MENU_INCLUDE = {
  kitchen: { select: { id: true, name: true, emoji: true } },
  webCategory: { select: { id: true, name: true, slug: true } },
  filtrosWeb: { include: { filtro: { select: { id: true, slug: true, label: true } } } },
} as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type MetricsRange = '7d' | '30d' | '90d' | 'Año';

function rangeToDays(range: MetricsRange): number {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return 365;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayLabel(d: Date, short: boolean): string {
  if (short) {
    return d.toLocaleDateString('es-AR', { weekday: 'short' });
  }
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function subDays(d: Date, n: number): Date {
  return addDays(d, -n);
}

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

  async getMetrics(from?: string, to?: string, range?: MetricsRange) {
    const effectiveRange = range ?? '30d';
    const days = rangeToDays(effectiveRange);

    let dateFrom: Date;
    let dateTo: Date;

    if (from || to) {
      dateFrom = from ? startOfDay(new Date(from)) : startOfDay(subDays(new Date(), days - 1));
      dateTo = to ? endOfDay(new Date(to)) : endOfDay(new Date());
    } else {
      dateFrom = startOfDay(subDays(new Date(), days - 1));
      dateTo = endOfDay(new Date());
    }

    const where = {
      status: { in: ['pagado', 'en_cocina', 'listo', 'retirado'] as string[] },
      createdAt: { gte: dateFrom, lte: dateTo },
    };

    const pedidos = await this.prisma.pedidoPublico.findMany({
      where,
      include: {
        items: true,
        ordenesCocina: { include: { kitchen: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const today = new Date();
    const todayPedidos = pedidos.filter((p) => isSameDay(p.createdAt, today));

    const totalPedidos = pedidos.length;
    const recaudacion = pedidos.reduce((s, p) => s + Number(p.total), 0);
    const recaudacionHoy = todayPedidos.reduce((s, p) => s + Number(p.total), 0);
    const ticketPromedio = totalPedidos > 0 ? Math.round(recaudacion / totalPedidos) : 0;

    const byStatusMap = new Map<string, number>();
    for (const p of pedidos) {
      byStatusMap.set(p.status, (byStatusMap.get(p.status) ?? 0) + 1);
    }

    const salesByDay: { id: string; day: string; ventas: number; tickets: number }[] = [];
    let cursor = dateFrom;
    let i = 0;
    while (cursor <= dateTo) {
      const dayPedidos = pedidos.filter((p) => isSameDay(p.createdAt, cursor));
      salesByDay.push({
        id: `day-${i}`,
        day: formatDayLabel(cursor, effectiveRange === '7d'),
        ventas: dayPedidos.reduce((s, p) => s + Number(p.total), 0),
        tickets: dayPedidos.length,
      });
      cursor = addDays(cursor, 1);
      i += 1;
    }

    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    const kitchenMap = new Map<
      string,
      Map<string, { name: string; qty: number; revenue: number }>
    >();

    for (const pedido of pedidos) {
      const kitchens = [
        ...new Set(pedido.ordenesCocina.map((o) => o.kitchen.name)),
      ];
      const defaultKitchen = kitchens[0] ?? 'Sin cocina';

      for (const row of pedido.items) {
        const prev = itemMap.get(row.name) ?? { name: row.name, quantity: 0, revenue: 0 };
        prev.quantity += row.quantity;
        prev.revenue += row.quantity * Number(row.unitPrice);
        itemMap.set(row.name, prev);

        if (!kitchenMap.has(defaultKitchen)) kitchenMap.set(defaultKitchen, new Map());
        const productsMap = kitchenMap.get(defaultKitchen)!;
        const pPrev = productsMap.get(row.name) ?? { name: row.name, qty: 0, revenue: 0 };
        productsMap.set(row.name, {
          name: row.name,
          qty: pPrev.qty + row.quantity,
          revenue: pPrev.revenue + row.quantity * Number(row.unitPrice),
        });
      }
    }

    const KITCHEN_COLORS: Record<string, string> = {
      Parrilla: '#f97316',
      Barra: '#0ea5e9',
      Cervecería: '#f59e0b',
      Cocina: '#10b981',
      'Sin cocina': '#94a3b8',
    };

    const topProductsByKitchen = [...kitchenMap.entries()].map(([kitchen, productsMap]) => {
      const allProducts = [...productsMap.values()]
        .map((p) => ({
          id: `${kitchen}-${p.name}`,
          name: p.name,
          value: p.qty,
          revenue: p.revenue,
        }))
        .sort((a, b) => b.value - a.value);
      return {
        kitchen,
        id: kitchen,
        color: KITCHEN_COLORS[kitchen] ?? '#94a3b8',
        products: allProducts.slice(0, 5),
        totalUnits: allProducts.reduce((s, p) => s + p.value, 0),
        totalRevenue: allProducts.reduce((s, p) => s + p.revenue, 0),
      };
    });

    const topItems = [...itemMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalPedidos,
      recaudacion,
      recaudacionHoy,
      ticketPromedio,
      ticketsHoy: todayPedidos.length,
      porEstado: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
      topItems,
      salesByDay,
      topProductsByKitchen,
      range: effectiveRange,
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
      include: WEB_MENU_INCLUDE,
      orderBy: [{ webSortOrder: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    });
  }

  async createWebMenuProduct(data: {
    name: string;
    category: string;
    kitchenId: string;
    price: number;
    emoji?: string;
    descripcionWeb?: string;
    imagenWeb?: string;
    visibleWeb?: boolean;
    webCategoryId?: string;
    popularWeb?: boolean;
    filterIds?: string[];
    recipe?: { stockProductId: string; quantity: number }[];
  }) {
    const product = await this.sales.createSalesProduct({
      name: data.name,
      category: data.category,
      kitchenId: data.kitchenId,
      price: data.price,
      emoji: data.emoji,
      recipe: data.recipe,
    });

    return this.updateWebMenu(product.id, {
      visibleWeb: data.visibleWeb ?? true,
      descripcionWeb: data.descripcionWeb ?? null,
      imagenWeb: data.imagenWeb ?? null,
      webCategoryId: data.webCategoryId ?? null,
      popularWeb: data.popularWeb ?? false,
      filterIds: data.filterIds ?? [],
    });
  }

  async updateWebMenu(
    id: string,
    data: {
      name?: string;
      category?: string;
      kitchenId?: string;
      visibleWeb?: boolean;
      descripcionWeb?: string | null;
      imagenWeb?: string | null;
      emoji?: string | null;
      price?: number;
      webCategoryId?: string | null;
      popularWeb?: boolean;
      webSortOrder?: number;
      filterIds?: string[];
      active?: boolean;
    },
  ) {
    const product = await this.prisma.productoVenta.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const { filterIds, ...rest } = data;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (filterIds !== undefined) {
        await tx.productoVentaFiltro.deleteMany({ where: { productoVentaId: id } });
        if (filterIds.length > 0) {
          await tx.productoVentaFiltro.createMany({
            data: filterIds.map((filtroWebId) => ({ productoVentaId: id, filtroWebId })),
          });
        }
      }

      return tx.productoVenta.update({
        where: { id },
        data: {
          name: rest.name,
          category: rest.category,
          kitchenId: rest.kitchenId,
          visibleWeb: rest.visibleWeb,
          descripcionWeb: rest.descripcionWeb,
          imagenWeb: rest.imagenWeb,
          emoji: rest.emoji ?? undefined,
          price: rest.price,
          webCategoryId: rest.webCategoryId,
          popularWeb: rest.popularWeb,
          webSortOrder: rest.webSortOrder,
          active: rest.active,
        },
        include: WEB_MENU_INCLUDE,
      });
    });

    return updated;
  }

  async listCategories() {
    return this.prisma.categoriaWeb.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { productos: true } } },
    });
  }

  async createCategory(data: { name: string; sortOrder?: number }) {
    const slug = slugify(data.name);
    return this.prisma.categoriaWeb.create({
      data: { name: data.name, slug, sortOrder: data.sortOrder ?? 0 },
    });
  }

  async updateCategory(
    id: string,
    data: { name?: string; sortOrder?: number; active?: boolean },
  ) {
    const cat = await this.prisma.categoriaWeb.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');

    return this.prisma.categoriaWeb.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.name ? slugify(data.name) : undefined,
        sortOrder: data.sortOrder,
        active: data.active,
      },
    });
  }

  async deleteCategory(id: string) {
    await this.prisma.productoVenta.updateMany({
      where: { webCategoryId: id },
      data: { webCategoryId: null },
    });
    return this.prisma.categoriaWeb.delete({ where: { id } });
  }

  async listFilters() {
    return this.prisma.filtroWeb.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      include: { _count: { select: { productos: true } } },
    });
  }

  async createFilter(data: { label: string; slug?: string; sortOrder?: number }) {
    const slug = data.slug ? slugify(data.slug) : slugify(data.label);
    return this.prisma.filtroWeb.create({
      data: { label: data.label, slug, sortOrder: data.sortOrder ?? 0 },
    });
  }

  async updateFilter(
    id: string,
    data: { label?: string; slug?: string; sortOrder?: number; active?: boolean },
  ) {
    const filtro = await this.prisma.filtroWeb.findUnique({ where: { id } });
    if (!filtro) throw new NotFoundException('Filtro no encontrado');

    return this.prisma.filtroWeb.update({
      where: { id },
      data: {
        label: data.label,
        slug: data.slug ? slugify(data.slug) : undefined,
        sortOrder: data.sortOrder,
        active: data.active,
      },
    });
  }

  async deleteFilter(id: string) {
    return this.prisma.filtroWeb.delete({ where: { id } });
  }

  async listKitchens() {
    return this.prisma.cocina.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, emoji: true },
    });
  }

  async redeemQr(token: string, operatorId: string) {
    const normalized = normalizeQrToken(token);
    const qr = await this.prisma.tokenRetiroQR.findUnique({
      where: { token: normalized },
      include: {
        pedido: {
          include: {
            items: true,
            ticketVenta: { select: { number: true } },
            ordenesCocina: { include: { kitchen: { select: { id: true, name: true, emoji: true } } } },
            cuentaPublica: {
              include: {
                persona: { select: { nombre: true, apellido: true } },
              },
            },
          },
        },
      },
    });

    if (!qr) {
      throw new NotFoundException('Código QR no encontrado');
    }
    if (qr.invalido) {
      throw new ConflictException('Código QR inválido');
    }
    if (qr.usadoEn || qr.pedido.status === 'retirado') {
      throw new ConflictException('Código QR ya utilizado');
    }
    if (!['en_cocina', 'listo', 'pagado'].includes(qr.pedido.status)) {
      throw new ConflictException(`Pedido en estado ${qr.pedido.status}, no retirable`);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tokenRetiroQR.update({
        where: { id: qr.id },
        data: { usadoEn: now },
      });

      const pedido = await tx.pedidoPublico.update({
        where: { id: qr.pedidoId },
        data: { status: 'retirado' },
        include: {
          items: true,
          tokenRetiro: true,
          ticketVenta: { select: { number: true } },
          ordenesCocina: { include: { kitchen: { select: { id: true, name: true, emoji: true } } } },
          cuentaPublica: {
            include: {
              persona: { select: { nombre: true, apellido: true } },
            },
          },
        },
      });

      await tx.ordenCocina.updateMany({
        where: { pedidoPublicoId: qr.pedidoId, status: { not: 'delivered' } },
        data: { status: 'delivered' },
      });

      return pedido;
    });

    const persona = updated.cuentaPublica?.persona;
    const customerName = persona
      ? `${persona.nombre} ${persona.apellido}`.trim()
      : updated.cuentaPublica?.email?.split('@')[0] ?? 'Cliente';

    const kitchens = [
      ...new Map(updated.ordenesCocina.map((o) => [o.kitchen.id, o.kitchen])).values(),
    ];

    return {
      ok: true,
      pedido: {
        id: updated.id,
        status: updated.status,
        total: Number(updated.total),
        ticketNumber: updated.ticketVenta?.number ?? null,
        customerName,
        kitchens: kitchens.map((k) => ({ id: k.id, name: k.name, emoji: k.emoji })),
        pickupKitchen: kitchens[0]?.name ?? null,
        items: updated.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          emoji: i.emoji,
        })),
        retiradoEn: now.toISOString(),
        operadorId: operatorId,
      },
    };
  }
}
