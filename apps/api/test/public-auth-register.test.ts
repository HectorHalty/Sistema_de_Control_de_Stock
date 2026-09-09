import { describe, it, expect, vi } from 'vitest';

// Mismo harness que public-auth-google.test.ts: el servicio construye un
// OAuth2Client en el constructor, así que la librería se mockea antes de importarlo.
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({ verifyIdToken: vi.fn() })),
}));

import { PublicAuthService } from '../src/public/public-auth.service';

const CUENTA = {
  id: 'cta-1',
  email: 'nuevo@mail.com',
  nombre: 'Nuevo Usuario',
  rol: 'usuario',
  avatarUrl: null,
  dniConfirmado: null,
  personaId: null,
  equipoSeguidoId: null,
  capitanAutorizado: null,
  persona: null,
  equipoSeguido: null,
};

function makePrisma() {
  return {
    cuentaPublica: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(CUENTA),
      findUniqueOrThrow: vi.fn().mockResolvedValue(CUENTA),
      update: vi.fn().mockResolvedValue(CUENTA),
    },
    persona: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    capitanAutorizado: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
  const jwt = { sign: () => 'tok' } as never;
  const config = { get: () => undefined } as never;
  return new PublicAuthService(prisma as never, jwt, config);
}

describe('register — cuenta sin DNI (spec §6)', () => {
  it('crea la cuenta con rol "usuario", sin Persona y sin vínculo de DNI', async () => {
    const prisma = makePrisma();
    const svc = makeService(prisma);

    const res = await svc.register({
      email: 'Nuevo@Mail.com',
      password: 'secreta123',
      nombre: '  Nuevo Usuario  ',
    });

    // 1. Ninguna Persona se crea ni se toca en el registro.
    expect(prisma.persona.upsert).not.toHaveBeenCalled();

    // 2. La cuenta se crea una sola vez, con rol 'usuario' y sin datos de DNI.
    expect(prisma.cuentaPublica.create).toHaveBeenCalledTimes(1);
    const data = prisma.cuentaPublica.create.mock.calls[0][0].data;
    expect(data.rol).toBe('usuario');
    expect(data).not.toHaveProperty('personaId');
    expect(data).not.toHaveProperty('dniConfirmado');
    expect(data).not.toHaveProperty('persona');
    expect(data.email).toBe('nuevo@mail.com');
    expect(data.nombre).toBe('Nuevo Usuario');

    // 3. La sesión devuelta refleja el estado "sin vincular".
    expect(res.user.rol).toBe('usuario');
    expect(res.user.needsDni).toBe(true);
    expect(res.user.personaId).toBeNull();
    expect(res.accessToken).toBe('tok');
  });
});
