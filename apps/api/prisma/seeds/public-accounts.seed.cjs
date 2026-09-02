const bcrypt = require('bcrypt');

const CAPITAN = {
  email: 'capitan@lachacra.test',
  password: 'capitan123',
  nombre: 'Carlos Capitán',
  dni: '28123456',
};

const JUGADOR = {
  email: 'jugador@lachacra.test',
  password: 'jugador123',
  nombre: 'Juan Pérez',
  dni: '30123456',
};

async function upsertPublicAccount(prisma, { email, password, nombre, dni, rol }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const parts = nombre.trim().split(/\s+/);
  const persona = await prisma.persona.upsert({
    where: { dni },
    update: {
      nombre: parts[0] ?? nombre,
      apellido: parts.slice(1).join(' ') || '',
      email,
    },
    create: {
      dni,
      nombre: parts[0] ?? nombre,
      apellido: parts.slice(1).join(' ') || '',
      email,
      fechaNacimiento: new Date('1995-06-15'),
    },
  });

  await prisma.cuentaPublica.updateMany({
    where: { personaId: persona.id, NOT: { email } },
    data: { personaId: null },
  });

  let cuenta = await prisma.cuentaPublica.findUnique({ where: { email } });
  if (cuenta) {
    cuenta = await prisma.cuentaPublica.update({
      where: { id: cuenta.id },
      data: {
        passwordHash,
        nombre,
        dniConfirmado: dni,
        personaId: persona.id,
        rol,
      },
    });
  } else {
    const legacy = await prisma.cuentaPublica.findFirst({
      where: {
        OR: [{ personaId: persona.id }, { dniConfirmado: dni }],
      },
    });
    if (legacy) {
      cuenta = await prisma.cuentaPublica.update({
        where: { id: legacy.id },
        data: {
          email,
          passwordHash,
          nombre,
          dniConfirmado: dni,
          personaId: persona.id,
          rol,
          googleId: null,
        },
      });
    } else {
      cuenta = await prisma.cuentaPublica.create({
        data: {
          email,
          passwordHash,
          nombre,
          dniConfirmado: dni,
          personaId: persona.id,
          rol,
        },
      });
    }
  }

  return { cuenta, persona };
}

async function seedPublicAccounts(prisma) {
  const capitanAuth = await prisma.capitanAutorizado.findFirst({
    where: { activo: true, email: { contains: 'capitan', mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });

  const { cuenta: capitanCuenta } = await upsertPublicAccount(prisma, {
    ...CAPITAN,
    rol: 'capitan',
  });

  if (capitanAuth) {
    await prisma.capitanAutorizado.update({
      where: { id: capitanAuth.id },
      data: {
        email: CAPITAN.email,
        dni: CAPITAN.dni,
        cuentaPublicaId: capitanCuenta.id,
        activo: true,
      },
    });
  }

  const inscripcionJugador = await prisma.inscripcionJugador.findFirst({
    where: { activa: true, persona: { dni: JUGADOR.dni } },
  });

  const { cuenta: jugadorCuenta, persona: jugadorPersona } = await upsertPublicAccount(prisma, {
    ...JUGADOR,
    rol: 'jugador',
  });

  if (!inscripcionJugador && capitanAuth) {
    await prisma.inscripcionJugador.upsert({
      where: {
        personaId_torneoId: {
          personaId: jugadorPersona.id,
          torneoId: capitanAuth.torneoId,
        },
      },
      update: {
        activa: true,
        rolPlantel: 'jugador',
        equipoInscripcionId: capitanAuth.equipoInscripcionId,
      },
      create: {
        personaId: jugadorPersona.id,
        torneoId: capitanAuth.torneoId,
        equipoInscripcionId: capitanAuth.equipoInscripcionId,
        rolPlantel: 'jugador',
        activa: true,
      },
    });
  }

  const onlineOp = await prisma.usuario.findUnique({ where: { username: 'online' } });
  if (!onlineOp) {
    const hash = await bcrypt.hash('online-internal', 10);
    await prisma.usuario.create({
      data: {
        username: 'online',
        name: 'Pedidos Online',
        role: 'Operador',
        password: hash,
      },
    });
    console.log('Usuario sistema "online" creado para checkout web.');
  }

  console.log(
    `Cuentas públicas: ${CAPITAN.email} (capitán) y ${JUGADOR.email} (jugador) — password: *123`,
  );
}

module.exports = { seedPublicAccounts, CAPITAN, JUGADOR };
