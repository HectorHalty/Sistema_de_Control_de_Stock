#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const shadowUrl =
  process.env.SHADOW_DATABASE_URL ??
  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_shadow?schema=public';

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
