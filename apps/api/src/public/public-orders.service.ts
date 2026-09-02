import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { SalesService } from '../sales/sales.service';
import { SseService } from '../sse/sse.service';
import type { PublicCheckoutDto } from './dto/public-orders.dto';

@Injectable()
export class PublicOrdersService {
  private onlineOperatorId: string | null = null;

  constructor(
    private prisma: PrismaService,
    private sales: SalesService,
    private sse: SseService,
  ) {}

  async checkout(cuentaId: string, dto: PublicCheckoutDto) {
    if (!dto.items.length) {
      throw new BadRequestException('El pedido debe tener al menos un ítem');
    }

    const operatorId = await this.getOnlineOperatorId();
    const ticketKey = dto.idempotencyKey ?? `public-${cuentaId}-${Date.now()}-${randomBytes(4).toString('hex')}`;

    const checkoutResult = await this.sales.checkout({
      items: dto.items,
      operatorId,
      idempotencyKey: `ticket-${ticketKey}`,
      note: dto.nota ?? 'Pedido web cantina',
    });

    const ticket = checkoutResult.ticket;

    const existingPedido = await this.prisma.pedidoPublico.findFirst({
      where: { ticketVentaId: ticket.id },
      include: this.orderInclude(),
    });
    if (existingPedido) {
      return this.formatOrder(existingPedido);
    }

    const token = this.generateQrToken();

    const pedido = await this.prisma.$transaction(async (tx) => {
      await tx.ticketVenta.update({
        where: { id: ticket.id },
        data: { origen: 'online' },
      });

      const created = await tx.pedidoPublico.create({
        data: {
          cuentaPublicaId: cuentaId,
          status: 'en_cocina',
          total: ticket.total,
          ticketVentaId: ticket.id,
          nota: dto.nota,
          items: {
            create: ticket.items.map((item) => ({
              salesProductId: item.salesProductId,
              name: item.name,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
            })),
          },
          tokenRetiro: {
            create: { token },
          },
        },
        include: this.orderInclude(),
      });

      await tx.ordenCocina.updateMany({
        where: { ticketId: ticket.id },
        data: { pedidoPublicoId: created.id },
      });

      return created;
    });

    for (const order of await this.prisma.ordenCocina.findMany({
      where: { pedidoPublicoId: pedido.id },
    })) {
      this.sse.broadcastKitchenEvent(
        'kitchen-order-updated',
        {
          orderId: order.id,
          status: order.status,
          ticketNumber: order.ticketNumber,
          kitchenId: order.kitchenId,
          pedidoPublicoId: pedido.id,
          origen: 'online',
        },
        order.kitchenId,
      );
    }

    return this.formatOrder(pedido);
  }

  async listOrders(cuentaId: string) {
    const rows = await this.prisma.pedidoPublico.findMany({
      where: { cuentaPublicaId: cuentaId },
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => this.formatOrder(r));
  }

  async getOrder(cuentaId: string, pedidoId: string) {
    const pedido = await this.prisma.pedidoPublico.findFirst({
      where: { id: pedidoId, cuentaPublicaId: cuentaId },
      include: this.orderInclude(),
    });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    return this.formatOrder(pedido);
  }

  private orderInclude() {
    return {
      items: true,
      tokenRetiro: true,
      ticketVenta: { select: { number: true, status: true } },
    } as const;
  }

  private formatOrder(pedido: {
    id: string;
    status: string;
    total: { toString(): string } | number;
    createdAt: Date;
    updatedAt: Date;
    items: {
      id: string;
      name: string;
      unitPrice: { toString(): string } | number;
      quantity: number;
      salesProductId: string | null;
    }[];
    tokenRetiro: { token: string; usadoEn: Date | null; invalido: boolean } | null;
    ticketVenta: { number: number; status: string } | null;
  }) {
    return {
      id: pedido.id,
      status: pedido.status,
      total: Number(pedido.total),
      createdAt: pedido.createdAt.toISOString(),
      updatedAt: pedido.updatedAt.toISOString(),
      ticketNumber: pedido.ticketVenta?.number ?? null,
      items: pedido.items.map((i) => ({
        id: i.id,
        name: i.name,
        unitPrice: Number(i.unitPrice),
        quantity: i.quantity,
        salesProductId: i.salesProductId,
      })),
      qr: pedido.tokenRetiro
        ? {
            token: pedido.tokenRetiro.token,
            usado: !!pedido.tokenRetiro.usadoEn,
            invalido: pedido.tokenRetiro.invalido,
          }
        : null,
    };
  }

  private generateQrToken() {
    return `LCH-${randomBytes(8).toString('hex').toUpperCase()}`;
  }

  private async getOnlineOperatorId() {
    if (this.onlineOperatorId) return this.onlineOperatorId;

    const online = await this.prisma.usuario.findFirst({
      where: { username: 'online' },
      select: { id: true },
    });
    if (online) {
      this.onlineOperatorId = online.id;
      return online.id;
    }

    const admin = await this.prisma.usuario.findFirst({
      where: { username: 'admin' },
      select: { id: true },
    });
    if (!admin) {
      throw new BadRequestException('Operador del sistema no configurado');
    }
    this.onlineOperatorId = admin.id;
    return admin.id;
  }
}
