/** Taxonomía de presentación de la web pública. Datos de referencia. */

const WEB_CATEGORIES = [
  { name: 'Comidas', slug: 'comidas', sortOrder: 0 },
  { name: 'Bebidas', slug: 'bebidas', sortOrder: 1 },
];

const WEB_FILTERS = [
  { slug: 'popular', label: 'Popular', sortOrder: 0 },
  { slug: 'economico', label: 'Económico', sortOrder: 1 },
  { slug: 'bebidas', label: 'Bebidas', sortOrder: 2 },
  { slug: 'sin_tacc', label: 'Sin Tacc', sortOrder: 3 },
];

async function seedWebTaxonomy(prisma) {
  for (const cat of WEB_CATEGORIES) {
    await prisma.categoriaWeb.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder, active: true },
      create: cat,
    });
  }

  for (const f of WEB_FILTERS) {
    await prisma.filtroWeb.upsert({
      where: { slug: f.slug },
      update: { label: f.label, sortOrder: f.sortOrder, active: true },
      create: f,
    });
  }

  console.log(
    `Taxonomía web: ${WEB_CATEGORIES.length} categorías, ${WEB_FILTERS.length} filtros.`,
  );
}

module.exports = { seedWebTaxonomy };
