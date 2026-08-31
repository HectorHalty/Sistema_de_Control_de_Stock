const MENU_ITEMS = [
  { name: 'Hamburguesa clásica', category: 'Comidas', emoji: '🍔', price: 8500, kitchen: 'Parrilla' },
  { name: 'Papas fritas', category: 'Comidas', emoji: '🍟', price: 4500, kitchen: 'Parrilla' },
  { name: 'Empanadas x3', category: 'Comidas', emoji: '🥟', price: 6000, kitchen: 'Cocina' },
  { name: 'Pizza muzzarella', category: 'Comidas', emoji: '🍕', price: 12000, kitchen: 'Cocina' },
  { name: 'Gaseosa 500ml', category: 'Bebidas', emoji: '🥤', price: 2500, kitchen: 'Barra' },
  { name: 'Cerveza artesanal', category: 'Bebidas', emoji: '🍺', price: 5500, kitchen: 'Cervecería' },
  { name: 'Agua mineral', category: 'Bebidas', emoji: '💧', price: 2000, kitchen: 'Barra' },
];

const SPONSORS = [
  {
    name: 'Sponsor Demo LCH',
    imageUrl: '/sponsors/demo-banner.png',
    placement: 'banner',
    linkUrl: 'https://lachacrafutbol.com.ar',
  },
  {
    name: 'Partner Deportivo',
    imageUrl: '/sponsors/demo-partner.png',
    placement: 'sidebar',
  },
];

async function seedCantinaPublica(prisma) {
  for (const item of MENU_ITEMS) {
    const kitchen = await prisma.cocina.findUnique({ where: { name: item.kitchen } });
    if (!kitchen) continue;

    await prisma.productoVenta.upsert({
      where: { name_kitchenId: { name: item.name, kitchenId: kitchen.id } },
      update: {
        category: item.category,
        price: item.price,
        emoji: item.emoji,
        active: true,
        visibleWeb: true,
        descripcionWeb: `${item.name} — cantina LCH`,
      },
      create: {
        name: item.name,
        category: item.category,
        kitchenId: kitchen.id,
        price: item.price,
        emoji: item.emoji,
        active: true,
        visibleWeb: true,
        descripcionWeb: `${item.name} — cantina LCH`,
      },
    });
  }

  for (const sponsor of SPONSORS) {
    const existing = await prisma.patrocinador.findFirst({ where: { name: sponsor.name } });
    if (existing) {
      await prisma.patrocinador.update({
        where: { id: existing.id },
        data: { ...sponsor, active: true },
      });
    } else {
      await prisma.patrocinador.create({ data: { ...sponsor, active: true } });
    }
  }

  console.log(`Cantina pública: ${MENU_ITEMS.length} ítems visibleWeb.`);
}

module.exports = { seedCantinaPublica };
