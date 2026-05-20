import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SseService } from '../sse/sse.service';
import { KitchenOrderStatus } from './dto';

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

  async findAllOrders(kitchenId?: string, status?: string) {
    return this.prisma.kitchenOrder.findMany({
      where: {
        ...(kitchenId ? { kitchenId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        kitchen: true,
        items: true,
        ticket: { select: { number: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOrderById(id: string) {
    const order = await this.prisma.kitchenOrder.findUnique({
      where: { id },
      include: { kitchen: true, items: true },
    });
    if (!order) throw new NotFoundException(`Kitchen order ${id} not found`);
    return order;
  }

  async transitionOrder(id: string, nextStatus: KitchenOrderStatus) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.kitchenOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundException(`Kitchen order ${id} not found`);

      const allowed = VALID_TRANSITIONS[order.status as KitchenOrderStatus];
      if (!allowed || !allowed.includes(nextStatus)) {
        throw new ConflictException(
          `Invalid transition: ${order.status} -> ${nextStatus}. Allowed: ${allowed.join(', ') || 'none (terminal)'}`,
        );
      }

      const updated = await tx.kitchenOrder.update({
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

  async getActiveOrdersForKitchen(kitchenId: string) {
    return this.prisma.kitchenOrder.findMany({
      where: { kitchenId, status: { not: 'delivered' } },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
