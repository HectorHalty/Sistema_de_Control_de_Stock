# Review package - Task 2

Range: 20ceaae..cd23f97

## Commits

```
cd23f97 refactor(db): aplastar 7 migraciones en una baseline generada
```

## Diff stat (todo el rango)

```
 apps/api/package.json                              |    1 +
 .../migrations/20250618130000_init/migration.sql   |  647 --------
 .../migration.sql                                  |  165 ---
 .../migration.sql                                  |  444 ------
 .../migration.sql                                  |   68 -
 .../migration.sql                                  |   41 -
 .../migration.sql                                  |    3 -
 .../20260904180000_admin_settings/migration.sql    |   67 -
 .../20260906120000_baseline/migration.sql          | 1565 ++++++++++++++++++++
 apps/api/scripts/generate-baseline.mjs             |   37 +
 10 files changed, 1603 insertions(+), 1435 deletions(-)
```

## Nota del controlador sobre el alcance de este paquete

El diff completo de `prisma/migrations/` se omite a proposito: son ~55 KB de SQL
generado por `prisma migrate diff` mas el SQL de las 7 migraciones borradas. Ese SQL
no se revisa linea por linea porque es generado y su fidelidad al schema ya la verifica
`npm run db:drift` (sale 0). Lo que si se incluye abajo es la caracterizacion del SQL
generado y el grep de sentencias destructivas. Si necesitas ver una parte concreta del
SQL, leelo en `apps/api/prisma/migrations/20260906120000_baseline/migration.sql` y decilo en tu reporte.

## Diff completo, excluyendo prisma/migrations (-U10)

```diff
diff --git a/apps/api/package.json b/apps/api/package.json
index 04a3c3c..a939f5a 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -6,20 +6,21 @@
   "scripts": {
     "dev": "nest start --watch",
     "build": "nest build",
     "start": "nest start",
     "start:prod": "node dist/main",
     "test": "vitest run",
     "test:watch": "vitest",
     "test:deep": "vitest run test/integration/platform-migration-deep.test.ts",
     "test:db": "node scripts/reset-test-db.mjs && vitest run --config vitest.db.config.ts",
     "db:drift": "node scripts/drift-check.mjs",
+    "db:baseline": "node scripts/generate-baseline.mjs",
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
diff --git a/apps/api/scripts/generate-baseline.mjs b/apps/api/scripts/generate-baseline.mjs
new file mode 100644
index 0000000..9d06cb6
--- /dev/null
+++ b/apps/api/scripts/generate-baseline.mjs
@@ -0,0 +1,37 @@
+#!/usr/bin/env node
+import { spawnSync } from 'node:child_process';
+import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
+import { join } from 'node:path';
+
+const DIR = join('prisma', 'migrations', '20260906120000_baseline');
+
+const result = spawnSync(
+  'npx',
+  [
+    'prisma',
+    'migrate',
+    'diff',
+    '--from-empty',
+    '--to-schema-datamodel',
+    'prisma/schema.prisma',
+    '--script',
+  ],
+  { encoding: 'utf8', shell: true },
+);
+
+if (result.status !== 0) {
+  console.error(result.stderr);
+  process.exit(result.status ?? 1);
+}
+
+const sql = result.stdout;
+if (!sql.includes('CREATE TABLE')) {
+  console.error('La baseline generada no contiene ning├║n CREATE TABLE. Abortando.');
+  process.exit(1);
+}
+
+rmSync(DIR, { recursive: true, force: true });
+mkdirSync(DIR, { recursive: true });
+writeFileSync(join(DIR, 'migration.sql'), sql, 'utf8');
+
+console.log(`Baseline regenerada: ${join(DIR, 'migration.sql')} (${sql.length} bytes)`);
```

## Caracterizacion del SQL generado

```
lineas: 1565
bytes: 55439
CREATE TABLE:            63
CREATE UNIQUE INDEX:     49
CREATE INDEX:            106
ADD CONSTRAINT FOREIGN KEY: 73
CREATE TYPE (enums):     0
```

## Grep de SQL destructivo en las DOS migraciones (debe estar vacio)

```
(sin coincidencias)
```

## Contenido de prisma/migrations

```
20260906120000_baseline
migration_lock.toml
```
