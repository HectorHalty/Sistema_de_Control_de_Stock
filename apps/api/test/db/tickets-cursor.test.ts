import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SalesService } from '../../src/sales/sales.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';

const prisma = testPrisma();
const prismaAsService = prisma as unknown as PrismaService;

function salesService() {
  return new SalesService(prismaAsService, new StockMovementsService(prismaAsService));
}

describe('paginación por cursor (TicketVenta) contra Postgres real', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedTickets(n: number) {
    const user = await prisma.usuario.create({
      data: { username: 'op-hist', name: 'Operador', role: 'Vendedor', password: 'x' },
    });
    for (let i = 0; i < n; i++) {
      await prisma.ticketVenta.create({
        data: {
          number: 2000 + i,
          total: i,
          origen: 'pos',
          status: 'emitido',
          operatorId: user.id,
        },
      });
    }
  }

  it('sin cursor ni limit devuelve un array (compat POS)', async () => {
    await seedTickets(3);
    const all = await salesService().findAllTickets();
    expect(Array.isArray(all)).toBe(true);
    expect(all).toHaveLength(3);
  });

  it('con limit y sin cursor devuelve { items, nextCursor }', async () => {
    await seedTickets(5);
    const sales = salesService();
    const page = await sales.findAllTickets(undefined, undefined, undefined, 2);
    expect(Array.isArray(page)).toBe(false);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeTruthy();

    const page2 = await sales.findAllTickets(undefined, undefined, page.nextCursor, 2);
    expect(page2.items).toHaveLength(2);
    const ids = [...page.items, ...page2.items].map(t => t.id);
    expect(new Set(ids).size).toBe(4);
  });
});
