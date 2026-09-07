/**
 * Seed de inventario: productos de stock, niveles por depósito, proveedores y movimientos.
 * Idempotente por código de producto / nombre de proveedor.
 */

const STOCK_PRODUCTS = [
  { code: 'STK-CARNE-001', name: 'Medallón de carne 120g', category: 'Carnes', unit: 'unidades', qty: { principal: 200, quincho: 40 } },
  { code: 'STK-PAN-001', name: 'Pan de hamburguesa', category: 'Panadería', unit: 'unidades', qty: { principal: 180, kiosco: 30 } },
  { code: 'STK-QUESO-001', name: 'Queso cheddar feta', category: 'Insumos', unit: 'unidades', qty: { principal: 150, quincho: 20 } },
  { code: 'STK-PAPA-001', name: 'Papas precocidas 1kg', category: 'Insumos', unit: 'kg', qty: { principal: 80, quincho: 15 } },
  { code: 'STK-EMPA-001', name: 'Empanada congelada', category: 'Insumos', unit: 'unidades', qty: { principal: 300, kiosco: 50 } },
  { code: 'STK-MUZZ-001', name: 'Muzzarella pizza 1kg', category: 'Insumos', unit: 'kg', qty: { principal: 40, quincho: 8 } },
  { code: 'STK-MASA-001', name: 'Masa pizza 30cm', category: 'Panadería', unit: 'unidades', qty: { principal: 60, quincho: 12 } },
  { code: 'STK-GASE-001', name: 'Gaseosa 500ml caja x12', category: 'Bebidas', unit: 'cajas', qty: { principal: 45, kiosco: 10, heladera: 5 } },
  { code: 'STK-AGUA-001', name: 'Agua mineral 500ml caja x12', category: 'Bebidas', unit: 'cajas', qty: { principal: 50, kiosco: 12, heladera: 8 } },
  { code: 'STK-CERV-001', name: 'Cerveza artesanal barril', category: 'Bebidas', unit: 'litros', qty: { principal: 120, quincho: 40 } },
  { code: 'STK-SNACK-001', name: 'Snack surtido', category: 'Snacks', unit: 'unidades', qty: { principal: 100, kiosco: 40 } },
  { code: 'STK-ACEI-001', name: 'Aceite de cocina 5L', category: 'Insumos', unit: 'unidades', qty: { principal: 12, quincho: 2 } },
  { code: 'STK-LECH-001', name: 'Lechuga fresca', category: 'Insumos', unit: 'kg', qty: { principal: 8, quincho: 2 } },
  { code: 'STK-TOM-001', name: 'Tomate fresco', category: 'Insumos', unit: 'kg', qty: { principal: 10, quincho: 3 } },
  { code: 'STK-SAL-001', name: 'Sal fina 1kg', category: 'Insumos', unit: 'unidades', qty: { principal: 20 } },
];

const SUPPLIERS = [
  { name: 'Distribuidora Norte SA', products: ['STK-CARNE-001', 'STK-PAPA-001', 'STK-EMPA-001'] },
  { name: 'Bebidas del Sur', products: ['STK-GASE-001', 'STK-AGUA-001', 'STK-CERV-001'] },
  { name: 'Panadería Central', products: ['STK-PAN-001', 'STK-MASA-001', 'STK-MUZZ-001'] },
];

const DEP_KEYS = {
  principal: 'Depósito Principal',
  quincho: 'Quincho Bar',
  kiosco: 'Kiosco Cancha',
  heladera: 'Heladera Vestuarios',
};

async function seedInventory(prisma) {
  const categories = await prisma.categoria.findMany();
  const catByName = new Map(categories.map((c) => [c.name, c.id]));
  const depositos = await prisma.deposito.findMany();
  const depByName = new Map(depositos.map((d) => [d.name, d.id]));

  const productIds = new Map();

  for (const item of STOCK_PRODUCTS) {
    const categoryId = catByName.get(item.category);
    if (!categoryId) continue;

    const product = await prisma.producto.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        categoryId,
        unit: item.unit,
        description: `${item.name} — stock demo LCH`,
      },
      create: {
        code: item.code,
        name: item.name,
        categoryId,
        unit: item.unit,
        description: `${item.name} — stock demo LCH`,
      },
    });
    productIds.set(item.code, product.id);

    for (const [key, qty] of Object.entries(item.qty)) {
      const warehouseId = depByName.get(DEP_KEYS[key]);
      if (!warehouseId) continue;
      await prisma.nivelStock.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId } },
        update: { quantity: qty },
        create: { productId: product.id, warehouseId, quantity: qty },
      });

      const reference = `SEED-INGRESO-DEMO:${item.code}:${key}`;
      const existingMovement = await prisma.movimientoStock.findFirst({
        where: { reference, productId: product.id, warehouseId },
      });
      if (!existingMovement) {
        await prisma.movimientoStock.create({
          data: {
            type: 'entrada',
            productId: product.id,
            warehouseId,
            quantity: qty,
            reference,
            operatorName: 'Seed',
          },
        });
      }
    }
  }

  for (const supplier of SUPPLIERS) {
    const row = await prisma.proveedor.upsert({
      where: { name: supplier.name },
      update: {},
      create: { name: supplier.name },
    });
    for (const code of supplier.products) {
      const productId = productIds.get(code);
      if (!productId) continue;
      await prisma.proveedorProducto.upsert({
        where: { supplierId_productId: { supplierId: row.id, productId } },
        update: {},
        create: { supplierId: row.id, productId },
      });
    }
  }

  console.log(
    `Inventario: ${STOCK_PRODUCTS.length} productos, ${SUPPLIERS.length} proveedores, niveles de stock.`,
  );
}

module.exports = { seedInventory, STOCK_PRODUCTS };
