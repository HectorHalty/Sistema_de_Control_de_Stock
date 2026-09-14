import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

async function seedCuenta() {
  return prisma.cuentaPublica.create({
    data: { email: 'socio@lch.test', passwordHash: 'hash' },
  });
}

describe('restricciones de cantina online', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rechaza un estado de pedido inventado', async () => {
    const cuenta = await seedCuenta();
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "pedidos_publicos" ("id", "cuentaPublicaId", "status", "total", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'en_camino', 100, now())`,
        cuenta.id,
      ),
    ).rejects.toThrow();
  });

  it('acepta los seis estados de pedido válidos', async () => {
    const cuenta = await seedCuenta();
    const estados = ['pendiente_pago', 'pagado', 'en_cocina', 'listo', 'retirado', 'cancelado'] as const;
    for (const status of estados) {
      const pedido = await prisma.pedidoPublico.create({
        data: { cuentaPublicaId: cuenta.id, status, total: 100 },
      });
      expect(pedido.status).toBe(status);
    }
  });

  it('rechaza un total de pedido negativo', async () => {
    const cuenta = await seedCuenta();
    await expect(
      prisma.pedidoPublico.create({
        data: { cuentaPublicaId: cuenta.id, total: -1 },
      }),
    ).rejects.toThrow();
  });

  it('rechaza dos patrocinadores con el mismo nombre', async () => {
    await prisma.patrocinador.create({ data: { name: 'Sponsor', imageUrl: '/a.png' } });
    await expect(
      prisma.patrocinador.create({ data: { name: 'Sponsor', imageUrl: '/b.png' } }),
    ).rejects.toThrow();
  });

  it('rechaza un placement de patrocinador inventado', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "patrocinadores" ("id", "name", "imageUrl", "placement", "updatedAt")
         VALUES (gen_random_uuid()::text, 'S2', '/c.png', 'popup', now())`,
      ),
    ).rejects.toThrow();
  });

  it('ya no existe la tabla del catálogo online heredado', async () => {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'productos_online'
    `;
    expect(rows).toEqual([]);
  });
});
