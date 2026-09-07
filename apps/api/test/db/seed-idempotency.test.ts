import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { testPrisma, resetTestDb, TEST_DATABASE_URL } from './helpers/db';

const prisma = testPrisma();

function runSeed(script: string) {
  return spawnSync('node', [`prisma/${script}`], {
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

describe('idempotencia de los seeds', () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('el seed de referencia corre dos veces sin errores y sin duplicar', async () => {
    const first = runSeed('seed.cjs');
    expect(first.status, first.stderr).toBe(0);
    const afterFirst = await prisma.categoria.count();

    const second = runSeed('seed.cjs');
    expect(second.status, second.stderr).toBe(0);
    const afterSecond = await prisma.categoria.count();

    expect(afterSecond).toBe(afterFirst);
  });

  it('el seed de referencia no cambia la contraseña de un usuario existente', async () => {
    const before = await prisma.usuario.findUnique({ where: { username: 'admin' } });
    expect(before).not.toBeNull();

    const again = runSeed('seed.cjs');
    expect(again.status, again.stderr).toBe(0);

    const after = await prisma.usuario.findUnique({ where: { username: 'admin' } });
    expect(after?.password).toBe(before?.password);
  });

  it('el seed de demo corre dos veces sin violar el número único de ticket', async () => {
    const first = runSeed('seed-demo.cjs');
    expect(first.status, first.stderr).toBe(0);
    const second = runSeed('seed-demo.cjs');
    expect(second.status, second.stderr).toBe(0);

    const numbers = await prisma.ticketVenta.findMany({ select: { number: true } });
    expect(new Set(numbers.map(n => n.number)).size).toBe(numbers.length);
  });

  it('el seed de demo no cambia contraseñas de cuentas públicas existentes', async () => {
    const before = await prisma.cuentaPublica.findMany({
      select: { email: true, passwordHash: true },
      orderBy: { email: 'asc' },
    });
    const again = runSeed('seed-demo.cjs');
    expect(again.status, again.stderr).toBe(0);
    const after = await prisma.cuentaPublica.findMany({
      select: { email: true, passwordHash: true },
      orderBy: { email: 'asc' },
    });
    expect(after).toEqual(before);
  });
});
