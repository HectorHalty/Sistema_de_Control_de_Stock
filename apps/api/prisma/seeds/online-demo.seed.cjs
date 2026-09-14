/**
 * Pedidos online demo + medios (fotos) en DB — no localStorage.
 */

async function seedOnlineDemo(prisma) {
  const filters = [
    { slug: 'popular', label: 'Popular', sortOrder: 0 },
    { slug: 'economico', label: 'Económico', sortOrder: 1 },
    { slug: 'bebidas', label: 'Bebidas', sortOrder: 2 },
    { slug: 'sin_tacc', label: 'Sin Tacc', sortOrder: 3 },
  ];
  for (const f of filters) {
    await prisma.filtroWeb.upsert({
      where: { slug: f.slug },
      update: { label: f.label, sortOrder: f.sortOrder, active: true },
      create: f,
    });
  }

  const mediaItems = [
    {
      key: 'seed/fotos/cancha-1.jpg',
      title: 'Cancha 1 — Jornada 1',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800',
      mimeType: 'image/jpeg',
      size: 120000,
      matchDate: new Date().toISOString().slice(0, 10),
    },
    {
      key: 'seed/fotos/cancha-2.jpg',
      title: 'Cancha 2 — Atardecer',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
      mimeType: 'image/jpeg',
      size: 110000,
      matchDate: new Date().toISOString().slice(0, 10),
    },
    {
      key: 'seed/fotos/vestuarios.jpg',
      title: 'Vestuarios LCH',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800',
      mimeType: 'image/jpeg',
      size: 100000,
      matchDate: null,
    },
  ];

  for (const m of mediaItems) {
    await prisma.medio.upsert({
      where: { key: m.key },
      update: {
        title: m.title,
        type: m.type,
        url: m.url,
        mimeType: m.mimeType,
        size: m.size,
        matchDate: m.matchDate,
      },
      create: m,
    });
  }

  const cuenta = await prisma.cuentaPublica.findUnique({
    where: { email: 'jugador@lachacra.test' },
  });
  const menu = await prisma.productoVenta.findMany({
    where: { visibleWeb: true, active: true },
    take: 3,
    orderBy: { name: 'asc' },
  });
  const operator = await prisma.usuario.findFirst({
    where: { OR: [{ username: 'online' }, { username: 'admin' }, { username: 'vendedor' }] },
  });

  if (cuenta && menu.length && operator) {
    const existingOrder = await prisma.pedidoPublico.findFirst({
      where: { nota: 'SEED-PEDIDO-DEMO' },
    });
    if (!existingOrder) {
      const items = menu.slice(0, 2).map((p) => ({
        salesProductId: p.id,
        name: p.name,
        unitPrice: p.price,
        quantity: 1,
        emoji: p.emoji,
      }));
      const total = items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
      const contador = await prisma.contadorTicket.update({
        where: { id: 'default' },
        data: { valor: { increment: 1 } },
      });
      const ticketNumber = contador.valor;

      const ticket = await prisma.ticketVenta.create({
        data: {
          number: ticketNumber,
          total,
          operatorId: operator.id,
          status: 'emitido',
          origen: 'online',
          note: 'SEED-PEDIDO-DEMO',
          items: {
            create: items.map((i) => ({
              salesProductId: i.salesProductId,
              name: i.name,
              unitPrice: i.unitPrice,
              quantity: i.quantity,
            })),
          },
        },
      });

      const pedido = await prisma.pedidoPublico.create({
        data: {
          cuentaPublicaId: cuenta.id,
          status: 'en_cocina',
          total,
          ticketVentaId: ticket.id,
          nota: 'SEED-PEDIDO-DEMO',
          items: {
            create: items.map((i) => ({
              salesProductId: i.salesProductId,
              name: i.name,
              unitPrice: i.unitPrice,
              quantity: i.quantity,
              emoji: i.emoji,
            })),
          },
          tokenRetiro: {
            create: {
              token: `LCH-SEED${Date.now().toString(36).toUpperCase()}`,
            },
          },
        },
      });

      const kitchen = await prisma.cocina.findFirst({ where: { name: 'Parrilla' } });
      if (kitchen) {
        await prisma.ordenCocina.create({
          data: {
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            kitchenId: kitchen.id,
            status: 'preparing',
            operatorName: operator.name,
            pedidoPublicoId: pedido.id,
            items: {
              create: items
                .filter((i) => i.salesProductId)
                .map((i) => ({
                  salesProductId: i.salesProductId,
                  name: i.name,
                  quantity: i.quantity,
                  emoji: i.emoji,
                })),
            },
          },
        });
      }
    }

    const listoExisting = await prisma.pedidoPublico.findFirst({
      where: { nota: 'SEED-PEDIDO-LISTO' },
    });
    if (!listoExisting && menu[0]) {
      const unitPrice = menu[0].price;
      const pedidoListo = await prisma.pedidoPublico.create({
        data: {
          cuentaPublicaId: cuenta.id,
          status: 'listo',
          total: unitPrice,
          nota: 'SEED-PEDIDO-LISTO',
          items: {
            create: [
              {
                salesProductId: menu[0].id,
                name: menu[0].name,
                unitPrice,
                quantity: 1,
                emoji: menu[0].emoji,
              },
            ],
          },
          tokenRetiro: {
            create: { token: `LCH-LISTO${Date.now().toString(36).toUpperCase()}` },
          },
        },
      });
      void pedidoListo;
    }
  }

  console.log(
    `Online demo: ${filters.length} filtros web, ${mediaItems.length} medios, pedidos de prueba.`,
  );
}

module.exports = { seedOnlineDemo };
