import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedReglamento } from './seeds/reglamento.seed.cjs';
import { seedScheduling } from './seeds/scheduling.seed.cjs';
import { seedTorneoDemo } from './seeds/torneo-demo.seed.cjs';
import { seedCantinaPublica } from './seeds/cantina.seed.cjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Categories
  await Promise.all([
    prisma.categoria.upsert({ where: { name: 'Bebidas' }, update: {}, create: { name: 'Bebidas', icon: 'Wine' } }),
    prisma.categoria.upsert({ where: { name: 'Snacks' }, update: {}, create: { name: 'Snacks', icon: 'Cookie' } }),
    prisma.categoria.upsert({ where: { name: 'Panadería' }, update: {}, create: { name: 'Panadería', icon: 'Croissant' } }),
    prisma.categoria.upsert({ where: { name: 'Carnes' }, update: {}, create: { name: 'Carnes', icon: 'Beef' } }),
    prisma.categoria.upsert({ where: { name: 'Insumos' }, update: {}, create: { name: 'Insumos', icon: 'Wrench' } }),
  ]);

  // Warehouses
  await Promise.all([
    prisma.deposito.upsert({
      where: { name: 'Depósito Principal' },
      update: {},
      create: { name: 'Depósito Principal', location: 'Edificio Central' },
    }),
    prisma.deposito.upsert({
      where: { name: 'Quincho Bar' },
      update: {},
      create: { name: 'Quincho Bar', location: 'Zona Quincho' },
    }),
    prisma.deposito.upsert({
      where: { name: 'Kiosco Cancha' },
      update: {},
      create: { name: 'Kiosco Cancha', location: 'Cancha 1' },
    }),
    prisma.deposito.upsert({
      where: { name: 'Heladera Vestuarios' },
      update: {},
      create: { name: 'Heladera Vestuarios', location: 'Vestuarios' },
    }),
  ]);

  // Kitchens
  await Promise.all([
    prisma.cocina.upsert({ where: { name: 'Parrilla' }, update: {}, create: { name: 'Parrilla', emoji: '🔥' } }),
    prisma.cocina.upsert({ where: { name: 'Cocina' }, update: {}, create: { name: 'Cocina', emoji: '🍳' } }),
    prisma.cocina.upsert({ where: { name: 'Cervecería' }, update: {}, create: { name: 'Cervecería', emoji: '🍺' } }),
    prisma.cocina.upsert({ where: { name: 'Barra' }, update: {}, create: { name: 'Barra', emoji: '🍹' } }),
  ]);

  // Default admin — never overwrite password on re-seed
  const existingAdmin = await prisma.usuario.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    const adminHash = await bcrypt.hash('admin123', 10);
    await prisma.usuario.create({
      data: { username: 'admin', name: 'Super Admin', role: 'SuperAdmin', password: adminHash },
    });
    console.log('Usuario admin creado. Password temporal: admin123 — CAMBIARLA YA.');
  } else {
    console.log('Usuario admin ya existe — password no modificada.');
  }

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

  await seedScheduling(prisma);
  await seedReglamento(prisma);
  await seedTorneoDemo(prisma);
  await seedCantinaPublica(prisma);

  console.log('Seed complete.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
