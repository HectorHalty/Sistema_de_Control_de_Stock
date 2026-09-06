import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

async function seedCatalog() {
  const categoria = await prisma.categoria.create({ data: { name: 'Bebidas' } });
  const deposito = await prisma.deposito.create({
    data: { name: 'Principal', location: 'Central' },
  });
  const producto = await prisma.producto.create({
    data: { name: 'Agua', code: 'BEB-001', categoryId: categoria.id, unit: 'unidades' },
  });
  return { categoria, deposito, producto };
}

describe('restricciones de stock', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rechaza un nivel de stock negativo', async () => {
    const { deposito, producto } = await seedCatalog();
    await expect(
      prisma.nivelStock.create({
        data: { productId: producto.id, warehouseId: deposito.id, quantity: -1 },
      }),
    ).rejects.toThrow();
  });

  it('acepta un nivel de stock en cero', async () => {
    const { deposito, producto } = await seedCatalog();
    const level = await prisma.nivelStock.create({
      data: { productId: producto.id, warehouseId: deposito.id, quantity: 0 },
    });
    expect(Number(level.quantity)).toBe(0);
  });

  it('rechaza un tipo de movimiento inventado', async () => {
    const { producto, deposito } = await seedCatalog();
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "movimientos_stock" ("id", "type", "productId", "warehouseId", "quantity")
         VALUES (gen_random_uuid()::text, 'tipo_inventado', $1, $2, 1)`,
        producto.id,
        deposito.id,
      ),
    ).rejects.toThrow();
  });

  it('acepta los seis tipos de movimiento válidos', async () => {
    const { producto, deposito } = await seedCatalog();
    const tipos = ['venta', 'devolucion', 'venta_anulada', 'ajuste_manual', 'consumo', 'entrada'] as const;
    for (const type of tipos) {
      const mov = await prisma.movimientoStock.create({
        data: { type, productId: producto.id, warehouseId: deposito.id, quantity: 1 },
      });
      expect(mov.type).toBe(type);
    }
  });

  it('rechaza una unidad de medida inventada', async () => {
    const { categoria } = await seedCatalog();
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "productos" ("id", "name", "code", "categoryId", "unit", "updatedAt")
         VALUES (gen_random_uuid()::text, 'X', 'X-1', $1, 'toneladas', now())`,
        categoria.id,
      ),
    ).rejects.toThrow();
  });

  it('acepta las cuatro unidades de medida válidas', async () => {
    const { categoria } = await seedCatalog();
    const unidades = ['unidades', 'kg', 'litros', 'cajas'] as const;
    for (const [i, unit] of unidades.entries()) {
      const p = await prisma.producto.create({
        data: { name: `P${i}`, code: `P-${i}`, categoryId: categoria.id, unit },
      });
      expect(p.unit).toBe(unit);
    }
  });

  it('rechaza un movimiento con un producto que no existe', async () => {
    await expect(
      prisma.movimientoStock.create({
        data: {
          type: 'entrada',
          productId: '00000000-0000-4000-8000-000000000099',
          quantity: 1,
        },
      }),
    ).rejects.toThrow();
  });

  it('impide borrar una categoría que tiene productos', async () => {
    const { categoria } = await seedCatalog();
    await expect(prisma.categoria.delete({ where: { id: categoria.id } })).rejects.toThrow();
  });

  it('rechaza un estado de pedido de compra inventado', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "ordenes_compra" ("id", "orderNumber", "date", "provider", "status", "updatedAt")
         VALUES (gen_random_uuid()::text, 'PED-001', '2026-09-06', 'X', 'EnCamino', now())`,
      ),
    ).rejects.toThrow();
  });

  it('ya no existen las tablas heredadas de consumo', async () => {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('logs_consumo', 'entradas_consumo')
    `;
    expect(rows).toEqual([]);
  });
});
