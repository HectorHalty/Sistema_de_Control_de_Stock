import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

describe('restricciones de auth y auditoría', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('acepta los siete roles canónicos', async () => {
    const roles = [
      'SuperAdmin',
      'Admin',
      'Operador_Stock',
      'Vendedor',
      'Gerente_Ventas',
      'Operador_Futbol',
      'Operador_Cocina',
    ] as const;
    for (const [i, role] of roles.entries()) {
      const u = await prisma.usuario.create({
        data: { username: `u${i}`, name: `U${i}`, role, password: 'x' },
      });
      expect(u.role).toBe(role);
    }
  });

  it('rechaza un rol heredado', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "usuarios" ("id", "username", "name", "role", "password", "updatedAt")
         VALUES (gen_random_uuid()::text, 'legacy', 'Legacy', 'Encargado_Stock', 'x', now())`,
      ),
    ).rejects.toThrow();
  });

  it('al borrar un usuario, su auditoría sobrevive con userId nulo', async () => {
    const usuario = await prisma.usuario.create({
      data: { username: 'auditado', name: 'A', role: 'Vendedor', password: 'x' },
    });
    const entrada = await prisma.entradaAuditoria.create({
      data: {
        userId: usuario.id,
        userName: 'auditado',
        action: 'creo',
        element: 'producto',
      },
    });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    const releida = await prisma.entradaAuditoria.findUnique({ where: { id: entrada.id } });
    expect(releida).not.toBeNull();
    expect(releida?.userId).toBeNull();
    expect(releida?.userName).toBe('auditado');
  });
});
