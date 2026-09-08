import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { EstadoOrdenCocina, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { SseService } from '../sse/sse.service';
import { normalizeLimit, toCursorPage, type CursorPage } from '../common/pagination';
import { KitchenOrderStatus } from './dto';

/** Tipo de retorno explícito para findAllOrders — ver comentario en Task 9. */
type KitchenOrderWithDetails = Prisma.OrdenCocinaGetPayload<{
  include: {
    kitchen: true;
    items: true;
    ticket: { select: { number: true; status: true; origen: true; total: true; createdAt: true } };
    pedidoPublico: {
      select: { id: true; status: true; tokenRetiro: { select: { token: true; usadoEn: true } } };
    };
  };
}>;

// Valid state transitions
const VALID_TRANSITIONS: Record<KitchenOrderStatus, KitchenOrderStatus[]> = {
  pending: ['preparing'],
  preparing: ['ready'],
  ready: ['delivered'],
  delivered: [], // terminal state
};

@Injectable()
export class KitchenService {
  constructor(
    private prisma: PrismaService,
    private sseService: SseService,
  ) {}

  /**
   * Sin `cursor`/`limit`: array completo (compatibilidad — el tablero de
   * cocina en vivo filtra por `status`, que es naturalmente chico). Con
   * alguno de los dos, pagina de verdad: sin filtro de `status` esta lista
   * es historial completo y crece sin límite. Ver Task 9 de
   * docs/superpowers/plans/2026-09-07-integridad-operacional-b.md.
   */
  async findAllOrders(kitchenId?: string, status?: string, onlineOnly?: boolean): Promise<KitchenOrderWithDetails[]>;
  async findAllOrders(
    kitchenId: string | undefined,
    status: string | undefined,
    onlineOnly: boolean | undefined,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<CursorPage<KitchenOrderWithDetails>>;
  async findAllOrders(kitchenId?: string, status?: string, onlineOnly?: boolean, cursor?: string, limit?: number) {
    const where = {
      ...(kitchenId ? { kitchenId } : {}),
      ...(status ? { status: status as EstadoOrdenCocina } : {}),
      ...(onlineOnly ? { pedidoPublicoId: { not: null } } : {}),
    };
    const include = {
      kitchen: true,
      items: true,
      ticket: { select: { number: true, status: true, origen: true, total: true, createdAt: true } },
      pedidoPublico: {
        select: {
          id: true,
          status: true,
          tokenRetiro: { select: { token: true, usadoEn: true } },
        },
      },
    } as const;

    if (cursor === undefined && limit === undefined) {
      return this.prisma.ordenCocina.findMany({ where, include, orderBy: { createdAt: 'asc' } });
    }
    const take = normalizeLimit(limit);
    const rows = await this.prisma.ordenCocina.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    return toCursorPage(rows, take);
  }

  async findOrderById(id: string) {
    const order = await this.prisma.ordenCocina.findUnique({
      where: { id },
      include: { kitchen: true, items: true },
    });
    if (!order) throw new NotFoundException(`Kitchen order ${id} not found`);
    return order;
  }

  async transitionOrder(id: string, nextStatus: KitchenOrderStatus) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.ordenCocina.findUnique({ where: { id } });
      if (!order) throw new NotFoundException(`Kitchen order ${id} not found`);

      const allowed = VALID_TRANSITIONS[order.status as KitchenOrderStatus];
      if (!allowed || !allowed.includes(nextStatus)) {
        throw new ConflictException(
          `Invalid transition: ${order.status} -> ${nextStatus}. Allowed: ${allowed.join(', ') || 'none (terminal)'}`,
        );
      }

      const updated = await tx.ordenCocina.update({
        where: { id },
        data: { status: nextStatus },
        include: { items: true, kitchen: true },
      });

      return updated;
    });

    // Broadcast SSE event after successful transition
    this.sseService.broadcastKitchenEvent(
      'kitchen-order-updated',
      { orderId: result.id, status: result.status, ticketNumber: result.ticketNumber, kitchenId: result.kitchenId },
      result.kitchenId,
    );

    return result;
  }

  async getActiveOrdersForKitchen(kitchenId: string, onlineOnly?: boolean) {
    return this.prisma.ordenCocina.findMany({
      where: {
        kitchenId,
        status: { not: 'delivered' },
        ...(onlineOnly ? { pedidoPublicoId: { not: null } } : {}),
      },
      include: {
        items: true,
        kitchen: true,
        ticket: { select: { number: true, status: true, origen: true, total: true, createdAt: true } },
        pedidoPublico: {
          select: {
            id: true,
            status: true,
            tokenRetiro: { select: { token: true, usadoEn: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
