/**
 * Datos de demostración. Opcional: `npm run prisma:seed:demo`.
 * Requiere que el seed de referencia (prisma/seed.cjs) ya haya corrido.
 */
const { PrismaClient } = require('@prisma/client');
const { seedInventory } = require('./seeds/inventory.seed.cjs');
const { seedTorneoDemo } = require('./seeds/torneo-demo.seed.cjs');
const { seedCantinaPublica } = require('./seeds/cantina.seed.cjs');
const { seedPublicAccounts } = require('./seeds/public-accounts.seed.cjs');
const { seedOnlineDemo } = require('./seeds/online-demo.seed.cjs');
const { seedDemoUsers } = require('./seeds/users-demo.seed.cjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  // El orden importa: torneo-demo necesita las categorías de scheduling,
  // cantina necesita los productos de stock, online-demo necesita cantina
  // y las cuentas públicas.
  await seedInventory(prisma);
  await seedTorneoDemo(prisma);
  await seedCantinaPublica(prisma);
  await seedPublicAccounts(prisma);
  await seedOnlineDemo(prisma);
  await seedDemoUsers(prisma);

  console.log('Demo seed complete.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
