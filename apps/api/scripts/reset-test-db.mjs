#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_test?schema=public';

console.log(`Reseteando base de test: ${url.replace(/:[^:@]+@/, ':****@')}`);

const result = spawnSync(
  'npx',
  ['prisma', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate'],
  {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  },
);

process.exit(result.status ?? 1);
