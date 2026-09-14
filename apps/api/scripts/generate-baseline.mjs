#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join('prisma', 'migrations', '20260906120000_baseline');

const result = spawnSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  { encoding: 'utf8', shell: true },
);

if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const sql = result.stdout;
if (!sql.includes('CREATE TABLE')) {
  console.error('La baseline generada no contiene ningún CREATE TABLE. Abortando.');
  process.exit(1);
}

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, 'migration.sql'), sql, 'utf8');

console.log(`Baseline regenerada: ${join(DIR, 'migration.sql')} (${sql.length} bytes)`);
