#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const url =
  process.env.DATABASE_URL ??
  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock?schema=public';
const outPath = process.argv[2];
if (!outPath) {
  console.error('Usage: node capture-row-counts.mjs <output.json>');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url } },
});

const tables = await prisma.$queryRawUnsafe(`
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`);

const counts = {};
for (const { tablename } of tables) {
  const quoted = `"${String(tablename).replace(/"/g, '""')}"`;
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM ${quoted}`);
  counts[tablename] = Number(rows[0].count);
}

await prisma.$disconnect();

const payload = {
  capturedAt: new Date().toISOString(),
  databaseUrl: url.replace(/:[^:@]+@/, ':****@'),
  tables: counts,
};
writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Wrote ${Object.keys(counts).length} table counts to ${outPath}`);
