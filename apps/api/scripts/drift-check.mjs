#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const shadowUrl =
  process.env.SHADOW_DATABASE_URL ??
  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_shadow?schema=public';

function parseDbName(connectionUrl) {
  const url = new URL(connectionUrl);
  const raw = url.pathname.replace(/^\//, '');
  const dbName = raw.split('/')[0];
  return decodeURIComponent(dbName);
}

function maintenanceUrlFrom(connectionUrl) {
  const url = new URL(connectionUrl);
  url.pathname = '/postgres';
  return url.toString();
}

async function ensureShadowDatabase() {
  const dbName = parseDbName(shadowUrl);
  const maintenanceUrl = maintenanceUrlFrom(shadowUrl);

  const prisma = new PrismaClient({
    datasources: { db: { url: maintenanceUrl } },
  });

  try {
    const escaped = dbName.replace(/"/g, '""');
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${escaped}"`);
  } catch (error) {
    const pgCode = error?.meta?.code;
    if (pgCode === '42P04') {
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await ensureShadowDatabase();

  const result = spawnSync(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-migrations',
      'prisma/migrations',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--shadow-database-url',
      shadowUrl,
      '--exit-code',
    ],
    { stdio: 'inherit', shell: true, env: { ...process.env } },
  );

  if (result.status === 0) {
    console.log('Sin deriva: schema.prisma y prisma/migrations coinciden.');
    process.exit(0);
  }

  if (result.status === 2) {
    console.error(
      'DERIVA DETECTADA: schema.prisma y prisma/migrations no coinciden. ' +
        'Regenerá la baseline con: node scripts/generate-baseline.mjs',
    );
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
