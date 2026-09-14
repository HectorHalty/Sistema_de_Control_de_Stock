const bcrypt = require('bcrypt');

/** Usuarios admin demo por rol — password siempre *123; create-if-missing o rehash si existen. */
const DEMO_USERS = [
  { username: 'stock', name: 'Operador Stock', role: 'Operador_Stock', password: 'stock123' },
  { username: 'vendedor', name: 'Vendedor Mostrador', role: 'Vendedor', password: 'vendedor123' },
  { username: 'gerente', name: 'Gerente Ventas', role: 'Gerente_Ventas', password: 'gerente123' },
  { username: 'futbol', name: 'Operador Fútbol', role: 'Operador_Futbol', password: 'futbol123' },
  { username: 'cocina', name: 'Operador Cocina', role: 'Operador_Cocina', password: 'cocina123' },
];

async function seedDemoUsers(prisma) {
  for (const u of DEMO_USERS) {
    const existing = await prisma.usuario.findUnique({ where: { username: u.username } });
    if (existing) {
      await prisma.usuario.update({
        where: { id: existing.id },
        data: { name: u.name, role: u.role },
      });
      continue;
    }
    await prisma.usuario.create({
      data: {
        username: u.username,
        name: u.name,
        role: u.role,
        password: await bcrypt.hash(u.password, 10),
      },
    });
  }
  console.log(
    `Usuarios demo: ${DEMO_USERS.map((u) => `${u.username}/${u.password}`).join(', ')}`,
  );
}

module.exports = { seedDemoUsers, DEMO_USERS };
