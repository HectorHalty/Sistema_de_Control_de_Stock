import { PrismaClient } from '@prisma/client';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_test?schema=public';

let client: PrismaClient | undefined;

/** Cliente Prisma apuntado a la base de test, compartido por archivo de test. */
export function testPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url: TEST_DATABASE_URL } },
    });
  }
  return client;
}

/**
 * Vacía todas las tablas de datos preservando el esquema.
 * Usa TRUNCATE ... CASCADE en una sola sentencia para no pelear con el orden
 * de las claves foráneas.
 */
export async function resetTestDb(): Promise<void> {
  const prisma = testPrisma();
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map(t => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}
