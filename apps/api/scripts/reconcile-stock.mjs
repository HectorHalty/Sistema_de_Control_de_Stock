#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Nivel materializado vs suma del libro mayor de movimientos. */
async function checkStockLevels() {
  const rows = await prisma.$queryRaw`
    SELECT
      p."code"        AS code,
      d."name"        AS warehouse,
      n."quantity"    AS nivel,
      COALESCE(m.suma, 0) AS movimientos
    FROM "niveles_stock" n
    JOIN "productos" p ON p."id" = n."productId"
    JOIN "depositos" d ON d."id" = n."warehouseId"
    LEFT JOIN (
      SELECT "productId", "warehouseId", SUM("quantity") AS suma
      FROM "movimientos_stock"
      WHERE "warehouseId" IS NOT NULL
      GROUP BY "productId", "warehouseId"
    ) m ON m."productId" = n."productId" AND m."warehouseId" = n."warehouseId"
    WHERE n."quantity" <> COALESCE(m.suma, 0)
    ORDER BY p."code"
  `;

  for (const r of rows) {
    console.error(
      `DERIVA stock  ${r.code} @ ${r.warehouse}: nivel=${r.nivel} movimientos=${r.movimientos}`,
    );
  }
  return rows.length;
}

/** Total guardado vs suma de las líneas del ticket. */
async function checkTicketTotals() {
  const rows = await prisma.$queryRaw`
    SELECT
      t."number"   AS numero,
      t."total"    AS total,
      COALESCE(i.suma, 0) AS suma_lineas
    FROM "tickets_venta" t
    LEFT JOIN (
      SELECT "ticketId", SUM("unitPrice" * "quantity") AS suma
      FROM "items_ticket_venta"
      GROUP BY "ticketId"
    ) i ON i."ticketId" = t."id"
    WHERE t."total" <> COALESCE(i.suma, 0)
    ORDER BY t."number"
  `;

  for (const r of rows) {
    console.error(
      `DERIVA ticket ${r.numero}: total=${r.total} suma_lineas=${r.suma_lineas}`,
    );
  }
  return rows.length;
}

/** Total guardado vs suma de las líneas del pedido público. Mismo riesgo que el ticket del POS. */
async function checkPedidoTotals() {
  const rows = await prisma.$queryRaw`
    SELECT
      p."id"       AS id,
      p."total"    AS total,
      COALESCE(i.suma, 0) AS suma_lineas
    FROM "pedidos_publicos" p
    LEFT JOIN (
      SELECT "pedidoId", SUM("unitPrice" * "quantity") AS suma
      FROM "items_pedido_publico"
      GROUP BY "pedidoId"
    ) i ON i."pedidoId" = p."id"
    WHERE p."total" <> COALESCE(i.suma, 0)
    ORDER BY p."id"
  `;

  for (const r of rows) {
    console.error(
      `DERIVA pedido ${r.id}: total=${r.total} suma_lineas=${r.suma_lineas}`,
    );
  }
  return rows.length;
}

async function main() {
  const stockDrift = await checkStockLevels();
  const ticketDrift = await checkTicketTotals();
  const pedidoDrift = await checkPedidoTotals();
  await prisma.$disconnect();

  const total = stockDrift + ticketDrift + pedidoDrift;
  if (total === 0) {
    console.log('Sin deriva: niveles de stock y totales de ticket y pedido coinciden con su origen.');
    process.exit(0);
  }

  console.error(
    `\n${total} inconsistencia(s). Este comando solo reporta: corregir los datos ` +
      `escondería el bug del backend que las produjo.`,
  );
  process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
