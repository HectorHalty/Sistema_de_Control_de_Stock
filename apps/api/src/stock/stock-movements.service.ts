import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

export type StockMovementType =
  | 'venta'
  | 'venta_anulada'
  | 'devolucion'
  | 'consumo'
  | 'entrada'
  | 'ajuste_manual';

export interface RecordMovementInput {
  type: StockMovementType;
  productId: string;
  warehouseId?: string;
  quantity: number;
  reference?: string;
  operatorId?: string;
  operatorName?: string;
}

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

@Injectable()
export class StockMovementsService {
  constructor(private prisma: PrismaService) {}

  async recordMany(
    tx: Prisma.TransactionClient,
    entries: RecordMovementInput[],
  ): Promise<void> {
    const data = entries
      .filter(e => e.quantity !== 0)
      .map(e => ({
        type: e.type,
        productId: e.productId,
        warehouseId: e.warehouseId ?? null,
        quantity: round3(e.quantity),
        reference: e.reference ?? null,
        operatorId: e.operatorId ?? null,
        operatorName: e.operatorName ?? null,
      }));
    if (data.length === 0) return;
    await tx.stockMovement.createMany({ data });
  }

  async findAll(filters?: {
    productId?: string;
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const where: Prisma.StockMovementWhereInput = {};
    if (filters?.productId) where.productId = filters.productId;
    if (filters?.type) where.type = filters.type;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }
    return this.prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 500,
    });
  }
}
