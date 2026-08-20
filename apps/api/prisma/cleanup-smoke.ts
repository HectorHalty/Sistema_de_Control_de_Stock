import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tickets = await prisma.ticketVenta.findMany({
    where: { number: { in: [1000, 1001] } },
    select: { id: true, number: true },
  });
  const ids = tickets.map(t => t.id);
  if (ids.length === 0) {
    console.log('No smoke tickets to remove.');
    return;
  }
  await prisma.ordenCocina.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.ticketVenta.deleteMany({ where: { id: { in: ids } } });
  console.log('Removed smoke tickets:', tickets.map(t => t.number).join(', '));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
