import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/auth.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';

const prisma = testPrisma();
const jwt = new JwtService({ secret: 'test-secret' });

/**
 * Dos AuthService "instancia A" y "instancia B" comparten el mismo Prisma
 * apuntado a la misma base — simula dos procesos de API detrás de un
 * balanceador. Antes de esta tarea el contador vivía en un Map en memoria
 * de proceso, así que este escenario habría fallado: cada instancia hubiera
 * llevado su propio conteo y ninguna llegaría nunca a bloquear sola.
 */
describe('lockout de login compartido entre instancias (Postgres)', () => {
  beforeEach(async () => {
    await resetTestDb();
    await prisma.usuario.create({
      data: {
        username: 'operador',
        name: 'Operador',
        role: 'Vendedor',
        password: await bcrypt.hash('correcta123', 4),
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('los intentos fallidos en una instancia bloquean el login en la otra', async () => {
    const instanciaA = new AuthService(prisma as unknown as PrismaService, jwt);
    const instanciaB = new AuthService(prisma as unknown as PrismaService, jwt);

    // 4 intentos fallidos repartidos entre A y B — ninguna instancia ve 4
    // localmente si el contador fuera en memoria de proceso.
    await expect(instanciaA.login('operador', 'mala')).rejects.toThrow('Invalid credentials');
    await expect(instanciaB.login('operador', 'mala')).rejects.toThrow('Invalid credentials');
    await expect(instanciaA.login('operador', 'mala')).rejects.toThrow('Invalid credentials');
    await expect(instanciaB.login('operador', 'mala')).rejects.toThrow('Invalid credentials');

    // El 5to intento fallido, en cualquiera de las dos, dispara el lockout.
    await expect(instanciaA.login('operador', 'mala')).rejects.toThrow('Invalid credentials');

    // Ahora el login correcto en la OTRA instancia también queda bloqueado.
    await expect(instanciaB.login('operador', 'correcta123')).rejects.toThrow(
      /Too many failed attempts/,
    );
  });

  it('un login correcto resetea el contador para ambas instancias', async () => {
    const instanciaA = new AuthService(prisma as unknown as PrismaService, jwt);
    const instanciaB = new AuthService(prisma as unknown as PrismaService, jwt);

    await expect(instanciaA.login('operador', 'mala')).rejects.toThrow();
    await expect(instanciaB.login('operador', 'mala')).rejects.toThrow();

    const result = await instanciaA.login('operador', 'correcta123');
    expect(result.access_token).toBeTruthy();

    const attempts = await prisma.intentoLogin.findUnique({ where: { username: 'operador' } });
    expect(attempts).toBeNull();
  });
});
