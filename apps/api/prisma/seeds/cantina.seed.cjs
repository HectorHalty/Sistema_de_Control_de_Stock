const MENU_ITEMS = [
  { name: 'Hamburguesa clásica', category: 'Comidas', emoji: '🍔', price: 8500, kitchen: 'Parrilla', popular: true },
  { name: 'Papas fritas', category: 'Comidas', emoji: '🍟', price: 4500, kitchen: 'Parrilla' },
  { name: 'Empanadas x3', category: 'Comidas', emoji: '🥟', price: 6000, kitchen: 'Cocina' },
  { name: 'Pizza muzzarella', category: 'Comidas', emoji: '🍕', price: 12000, kitchen: 'Cocina' },
  { name: 'Gaseosa 500ml', category: 'Bebidas', emoji: '🥤', price: 2500, kitchen: 'Barra', filters: ['bebidas'] },
  { name: 'Cerveza artesanal', category: 'Bebidas', emoji: '🍺', price: 5500, kitchen: 'Cervecería', filters: ['bebidas', 'popular'] },
  { name: 'Agua mineral', category: 'Bebidas', emoji: '💧', price: 2000, kitchen: 'Barra', filters: ['bebidas', 'economico'] },
];

const WEB_CATEGORIES = [
  { name: 'Comidas', slug: 'comidas', sortOrder: 0 },
  { name: 'Bebidas', slug: 'bebidas', sortOrder: 1 },
];

const SPONSORS = [
  {
    name: 'Sponsor Demo LCH',
    imageUrl: '/sponsors/demo-banner.png',
    placement: 'banner',
    bannerLabel: 'Home — Hero superior',
    mediaType: 'image',
    widthPx: 920,
    heightPx: 86,
    linkUrl: 'https://lachacrafutbol.com.ar',
  },
  {
    name: 'Promo Cantina',
    imageUrl: '/sponsors/demo-banner.png',
    placement: 'banner',
    bannerLabel: 'Cantina — Promo del día',
    mediaType: 'image',
    widthPx: 768,
    heightPx: 112,
  },
  {
    name: 'Partner Deportivo',
    imageUrl: '/sponsors/demo-partner.png',
    placement: 'sidebar',
    bannerLabel: 'Sidebar — Lateral navegación',
    mediaType: 'image',
    widthPx: 230,
    heightPx: 120,
  },
  {
    name: 'Sponsor Footer LCH',
    imageUrl: '/sponsors/demo-partner.png',
    placement: 'footer',
    bannerLabel: 'Footer — Franja inferior',
    mediaType: 'image',
    widthPx: 920,
    heightPx: 64,
    linkUrl: 'https://lachacrafutbol.com.ar',
  },
];

async function seedCantinaPublica(prisma) {
  const categoryMap = new Map();
  for (const cat of WEB_CATEGORIES) {
    const row = await prisma.categoriaWeb.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder, active: true },
      create: cat,
    });
    categoryMap.set(cat.name, row.id);
  }

  const filterRows = await prisma.filtroWeb.findMany();
  const filterMap = new Map(filterRows.map((f) => [f.slug, f.id]));

  for (const item of MENU_ITEMS) {
    const kitchen = await prisma.cocina.findUnique({ where: { name: item.kitchen } });
    if (!kitchen) continue;

    const webCategoryId = categoryMap.get(item.category) ?? null;
    const filterIds = (item.filters ?? []).map((slug) => filterMap.get(slug)).filter(Boolean);

    const product = await prisma.productoVenta.upsert({
      where: { name_kitchenId: { name: item.name, kitchenId: kitchen.id } },
      update: {
        category: item.category,
        price: item.price,
        emoji: item.emoji,
        active: true,
        visibleWeb: true,
        descripcionWeb: `${item.name} — cantina LCH`,
        webCategoryId,
        popularWeb: !!item.popular,
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
        webCategoryId,
        popularWeb: !!item.popular,
      },
    });

    if (filterIds.length) {
      await prisma.productoVentaFiltro.deleteMany({ where: { productoVentaId: product.id } });
      await prisma.productoVentaFiltro.createMany({
        data: filterIds.map((filtroWebId) => ({ productoVentaId: product.id, filtroWebId })),
        skipDuplicates: true,
      });
    }
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

  console.log(`Cantina pública: ${MENU_ITEMS.length} ítems, ${WEB_CATEGORIES.length} categorías web.`);
}

module.exports = { seedCantinaPublica };
