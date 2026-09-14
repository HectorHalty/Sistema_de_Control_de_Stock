import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

describe('base de datos de test', () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('está accesible y responde una consulta', async () => {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(rows[0].ok).toBe(1);
  });

  it('tiene el esquema migrado y arranca vacía', async () => {
    expect(await prisma.producto.count()).toBe(0);
    expect(await prisma.usuario.count()).toBe(0);
  });
});
