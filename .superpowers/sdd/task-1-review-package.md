# Review package - Task 1

Range: 8743ed7..HEAD

## Commits

```
20ceaae fix(api): aislar la suite de base de datos de npm test y autocrear la base shadow
2d1acf6 test(api): agregar suite de tests contra PostgreSQL real y chequeo de deriva
```

## Diff stat

```
 apps/api/package.json              |  2 +
 apps/api/scripts/drift-check.mjs   | 83 ++++++++++++++++++++++++++++++++++++++
 apps/api/scripts/reset-test-db.mjs | 20 +++++++++
 apps/api/test/db/helpers/db.ts     | 33 +++++++++++++++
 apps/api/test/db/smoke.test.ts     | 24 +++++++++++
 apps/api/vitest.config.ts          |  3 +-
 apps/api/vitest.db.config.ts       | 13 ++++++
 7 files changed, 177 insertions(+), 1 deletion(-)
```

## Full diff (-U10)

```diff
diff --git a/apps/api/package.json b/apps/api/package.json
index 8daf989..04a3c3c 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -4,20 +4,22 @@
   "private": true,
   "description": "Backend del Sistema de Gesti├│n LCH ΓÇö La Chacra F├║tbol",
   "scripts": {
     "dev": "nest start --watch",
     "build": "nest build",
     "start": "nest start",
     "start:prod": "node dist/main",
     "test": "vitest run",
     "test:watch": "vitest",
     "test:deep": "vitest run test/integration/platform-migration-deep.test.ts",
+    "test:db": "node scripts/reset-test-db.mjs && vitest run --config vitest.db.config.ts",
+    "db:drift": "node scripts/drift-check.mjs",
     "prisma:generate": "prisma generate",
     "prisma:migrate": "prisma migrate dev",
     "prisma:seed": "node prisma/seed.cjs",
     "prisma:seed:reglamento-data": "node prisma/seeds/build-reglamento-data.mjs",
     "prisma:studio": "prisma studio"
   },
   "dependencies": {
     "@aws-sdk/client-s3": "^3.1049.0",
     "@aws-sdk/s3-request-presigner": "^3.1049.0",
     "@nestjs/common": "^11.1.27",
diff --git a/apps/api/scripts/drift-check.mjs b/apps/api/scripts/drift-check.mjs
new file mode 100644
index 0000000..39a5c72
--- /dev/null
+++ b/apps/api/scripts/drift-check.mjs
@@ -0,0 +1,83 @@
+#!/usr/bin/env node
+import { spawnSync } from 'node:child_process';
+import { PrismaClient } from '@prisma/client';
+
+const shadowUrl =
+  process.env.SHADOW_DATABASE_URL ??
+  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_shadow?schema=public';
+
+function parseDbName(connectionUrl) {
+  const url = new URL(connectionUrl);
+  const raw = url.pathname.replace(/^\//, '');
+  const dbName = raw.split('/')[0];
+  return decodeURIComponent(dbName);
+}
+
+function maintenanceUrlFrom(connectionUrl) {
+  const url = new URL(connectionUrl);
+  url.pathname = '/postgres';
+  return url.toString();
+}
+
+async function ensureShadowDatabase() {
+  const dbName = parseDbName(shadowUrl);
+  const maintenanceUrl = maintenanceUrlFrom(shadowUrl);
+
+  const prisma = new PrismaClient({
+    datasources: { db: { url: maintenanceUrl } },
+  });
+
+  try {
+    const escaped = dbName.replace(/"/g, '""');
+    await prisma.$executeRawUnsafe(`CREATE DATABASE "${escaped}"`);
+  } catch (error) {
+    const pgCode = error?.meta?.code;
+    if (pgCode === '42P04') {
+      return;
+    }
+    throw error;
+  } finally {
+    await prisma.$disconnect();
+  }
+}
+
+async function main() {
+  await ensureShadowDatabase();
+
+  const result = spawnSync(
+    'npx',
+    [
+      'prisma',
+      'migrate',
+      'diff',
+      '--from-migrations',
+      'prisma/migrations',
+      '--to-schema-datamodel',
+      'prisma/schema.prisma',
+      '--shadow-database-url',
+      shadowUrl,
+      '--exit-code',
+    ],
+    { stdio: 'inherit', shell: true, env: { ...process.env } },
+  );
+
+  if (result.status === 0) {
+    console.log('Sin deriva: schema.prisma y prisma/migrations coinciden.');
+    process.exit(0);
+  }
+
+  if (result.status === 2) {
+    console.error(
+      'DERIVA DETECTADA: schema.prisma y prisma/migrations no coinciden. ' +
+        'Regener├í la baseline con: node scripts/generate-baseline.mjs',
+    );
+    process.exit(1);
+  }
+
+  process.exit(result.status ?? 1);
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});
diff --git a/apps/api/scripts/reset-test-db.mjs b/apps/api/scripts/reset-test-db.mjs
new file mode 100644
index 0000000..1b7ab4e
--- /dev/null
+++ b/apps/api/scripts/reset-test-db.mjs
@@ -0,0 +1,20 @@
+#!/usr/bin/env node
+import { spawnSync } from 'node:child_process';
+
+const url =
+  process.env.TEST_DATABASE_URL ??
+  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_test?schema=public';
+
+console.log(`Reseteando base de test: ${url.replace(/:[^:@]+@/, ':****@')}`);
+
+const result = spawnSync(
+  'npx',
+  ['prisma', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate'],
+  {
+    stdio: 'inherit',
+    shell: true,
+    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
+  },
+);
+
+process.exit(result.status ?? 1);
diff --git a/apps/api/test/db/helpers/db.ts b/apps/api/test/db/helpers/db.ts
new file mode 100644
index 0000000..eb7b78d
--- /dev/null
+++ b/apps/api/test/db/helpers/db.ts
@@ -0,0 +1,33 @@
+import { PrismaClient } from '@prisma/client';
+
+export const TEST_DATABASE_URL =
+  process.env.TEST_DATABASE_URL ??
+  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_test?schema=public';
+
+let client: PrismaClient | undefined;
+
+/** Cliente Prisma apuntado a la base de test, compartido por archivo de test. */
+export function testPrisma(): PrismaClient {
+  if (!client) {
+    client = new PrismaClient({
+      datasources: { db: { url: TEST_DATABASE_URL } },
+    });
+  }
+  return client;
+}
+
+/**
+ * Vac├¡a todas las tablas de datos preservando el esquema.
+ * Usa TRUNCATE ... CASCADE en una sola sentencia para no pelear con el orden
+ * de las claves for├íneas.
+ */
+export async function resetTestDb(): Promise<void> {
+  const prisma = testPrisma();
+  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
+    SELECT tablename FROM pg_tables
+    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
+  `;
+  if (tables.length === 0) return;
+  const list = tables.map(t => `"public"."${t.tablename}"`).join(', ');
+  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
+}
diff --git a/apps/api/test/db/smoke.test.ts b/apps/api/test/db/smoke.test.ts
new file mode 100644
index 0000000..7a56d6a
--- /dev/null
+++ b/apps/api/test/db/smoke.test.ts
@@ -0,0 +1,24 @@
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { testPrisma, resetTestDb } from './helpers/db';
+
+const prisma = testPrisma();
+
+describe('base de datos de test', () => {
+  beforeAll(async () => {
+    await resetTestDb();
+  });
+
+  afterAll(async () => {
+    await prisma.$disconnect();
+  });
+
+  it('est├í accesible y responde una consulta', async () => {
+    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
+    expect(rows[0].ok).toBe(1);
+  });
+
+  it('tiene el esquema migrado y arranca vac├¡a', async () => {
+    expect(await prisma.producto.count()).toBe(0);
+    expect(await prisma.usuario.count()).toBe(0);
+  });
+});
diff --git a/apps/api/vitest.config.ts b/apps/api/vitest.config.ts
index ea9adbe..dc63e31 100644
--- a/apps/api/vitest.config.ts
+++ b/apps/api/vitest.config.ts
@@ -1,10 +1,11 @@
-import { defineConfig } from 'vitest/config';
+import { defineConfig, configDefaults } from 'vitest/config';
 
 export default defineConfig({
   test: {
     globals: true,
     environment: 'node',
     include: ['test/**/*.test.ts'],
+    exclude: [...configDefaults.exclude, 'test/db/**'],
     setupFiles: ['test/setup-reflect.ts'],
   },
 });
diff --git a/apps/api/vitest.db.config.ts b/apps/api/vitest.db.config.ts
new file mode 100644
index 0000000..32ae792
--- /dev/null
+++ b/apps/api/vitest.db.config.ts
@@ -0,0 +1,13 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig({
+  test: {
+    globals: true,
+    environment: 'node',
+    include: ['test/db/**/*.test.ts'],
+    setupFiles: ['test/setup-reflect.ts'],
+    fileParallelism: false,
+    testTimeout: 30000,
+    hookTimeout: 60000,
+  },
+});
```
