import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Categories
  const categories = await Promise.all([
    prisma.categoria.upsert({ where: { name: 'Bebidas' }, update: {}, create: { name: 'Bebidas', icon: 'Wine' } }),
    prisma.categoria.upsert({ where: { name: 'Snacks' }, update: {}, create: { name: 'Snacks', icon: 'Cookie' } }),
    prisma.categoria.upsert({ where: { name: 'Panadería' }, update: {}, create: { name: 'Panadería', icon: 'Croissant' } }),
    prisma.categoria.upsert({ where: { name: 'Carnes' }, update: {}, create: { name: 'Carnes', icon: 'Beef' } }),
    prisma.categoria.upsert({ where: { name: 'Insumos' }, update: {}, create: { name: 'Insumos', icon: 'Wrench' } }),
  ]);

  // Warehouses
  const warehouses = await Promise.all([
    prisma.deposito.upsert({ where: { name: 'Depósito Principal' }, update: {}, create: { name: 'Depósito Principal', location: 'Edificio Central' } }),
    prisma.deposito.upsert({ where: { name: 'Quincho Bar' }, update: {}, create: { name: 'Quincho Bar', location: 'Zona Quincho' } }),
    prisma.deposito.upsert({ where: { name: 'Kiosco Cancha' }, update: {}, create: { name: 'Kiosco Cancha', location: 'Cancha 1' } }),
    prisma.deposito.upsert({ where: { name: 'Heladera Vestuarios' }, update: {}, create: { name: 'Heladera Vestuarios', location: 'Vestuarios' } }),
  ]);

  // Kitchens
  const kitchens = await Promise.all([
    prisma.cocina.upsert({ where: { name: 'Parrilla' }, update: {}, create: { name: 'Parrilla', emoji: '🔥' } }),
    prisma.cocina.upsert({ where: { name: 'Cocina' }, update: {}, create: { name: 'Cocina', emoji: '🍳' } }),
    prisma.cocina.upsert({ where: { name: 'Cervecería' }, update: {}, create: { name: 'Cervecería', emoji: '🍺' } }),
    prisma.cocina.upsert({ where: { name: 'Barra' }, update: {}, create: { name: 'Barra', emoji: '🍹' } }),
  ]);

  // Default user with hashed password
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.usuario.upsert({
    where: { username: 'admin' },
    update: {
      password: adminHash,
      role: 'SuperAdmin',
      name: 'Super Admin',
    },
    create: { username: 'admin', name: 'Super Admin', role: 'SuperAdmin', password: adminHash },
  });

  await prisma.contadorTicket.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', valor: 1000 },
  });

  await prisma.contadorPedido.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', valor: 0 },
  });

  console.log('Seed complete. Default admin password: admin123');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
