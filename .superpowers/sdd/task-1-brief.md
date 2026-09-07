# Brief — Task 1

Extraído de `docs/superpowers/plans/2026-09-06-integridad-esquema-bd.md`. Estos son tus requisitos: usá los valores exactos que aparecen acá, verbatim.

## Global Constraints

- Directorio raíz del repo: `D:\Desarrollo\LCH SISTEMA\Stock La Chacra Futbol\SistemaLCH\Sistema_de_Control_de_Stock`. Todas las rutas del plan son relativas a esa raíz.
- La mayoría de los comandos corren desde `apps/api`. Cada paso indica su directorio.
- El sistema está solo en desarrollo. Borrar y recrear la base es una operación esperada, no un riesgo.
- `prisma/migrations/` debe terminar con `20260906120000_baseline` y, salvo que aplique la contingencia de abajo, `20260906120100_constraints`. No debe quedar ninguna otra carpeta.
- **Contingencia sobre las `CHECK` constraints (decidida, gobierna sobre la línea anterior):** si `npm run db:drift` reporta las `CHECK` como deriva pendiente, los `CHECK` salen de `prisma/migrations/` y pasan a `scripts/apply-constraints.mjs`, expuesto como `db:constraints` y encadenado detrás de cada script que resetee la base (`test:db` y el flujo documentado en el runbook). En ese caso `prisma/migrations/` queda con una sola carpeta y el runbook tiene que decir explícitamente que `migrate reset` por sí solo no deja la base completa.
- `20260906120000_baseline/migration.sql` **nunca** se edita a mano. Se regenera con `node scripts/generate-baseline.mjs`.
- Todo SQL manual va únicamente en `20260906120100_constraints/migration.sql`, es aditivo y no contiene `DELETE`, `DROP` ni `UPDATE`.
- Los valores de cada enum son los del spec, que salen del código, no de la invención. No agregar ni renombrar valores.
- Prohibido usar `>` de PowerShell para escribir archivos de migración: la redirección puede producir UTF-16 con BOM y romper Prisma. Para eso existe `scripts/generate-baseline.mjs`.
- Cantidades de línea de venta (`ItemTicketVenta.quantity`, `ItemOrdenCocina.quantity`, `ItemComboVenta.quantity`, `ItemPedidoPublico.quantity`) se quedan en `Int`. No convertir a `Decimal`.
- No tocar transacciones, condiciones de carrera, paginación ni la capa de localStorage del admin: son los proyectos B y C.
- Base de datos de desarrollo: `postgresql://lch:lch_dev_pass@localhost:5432/lch_stock?schema=public`
- Base de datos de tests: `postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_test?schema=public`
- Base shadow para el chequeo de deriva: `postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_shadow?schema=public`


---

### Task 1: Infraestructura de tests contra PostgreSQL real

La suite actual de `test/integration/` usa `createPrismaMock` de `test/helpers/stock-test-store.ts`. Un mock acepta cualquier cosa que se le mande, así que no puede verificar ninguna restricción de base de datos. Esta tarea agrega una categoría de tests separada que corre contra el Postgres de `docker-compose.yml`, sin tocar la suite existente.

**Files:**
- Create: `apps/api/vitest.db.config.ts`
- Create: `apps/api/scripts/reset-test-db.mjs`
- Create: `apps/api/scripts/drift-check.mjs`
- Create: `apps/api/test/db/helpers/db.ts`
- Test: `apps/api/test/db/smoke.test.ts`
- Modify: `apps/api/package.json:6-19` (scripts)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `testPrisma(): PrismaClient` — cliente Prisma apuntado a `lch_stock_test`, exportado desde `test/db/helpers/db.ts`.
  - `resetTestDb(): Promise<void>` — exportado desde `test/db/helpers/db.ts`; trunca todas las tablas de datos.
  - `npm run test:db` — corre `test/db/**/*.test.ts`.
  - `npm run db:drift` — falla si `schema.prisma` y `prisma/migrations/` no coinciden.

- [ ] **Step 1: Levantar la infraestructura de docker**

Desde la raíz del repo:

```bash
npm run dev:infra
```

Esperado: `postgres`, `redis` y `minio` en estado healthy. Verificar con:

```bash
docker compose ps
```

- [ ] **Step 2: Escribir el test de humo que falla**

Crear `apps/api/test/db/smoke.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

describe('base de datos de test', () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('está accesible y responde una consulta', async () => {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(rows[0].ok).toBe(1);
  });

  it('tiene el esquema migrado y arranca vacía', async () => {
    expect(await prisma.producto.count()).toBe(0);
    expect(await prisma.usuario.count()).toBe(0);
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Desde `apps/api`:

```bash
npx vitest run --config vitest.db.config.ts
```

Esperado: FAIL. El error es de resolución de módulo: no existe `vitest.db.config.ts` ni `./helpers/db`.

- [ ] **Step 4: Crear el helper de base de datos**

Crear `apps/api/test/db/helpers/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_test?schema=public';

let client: PrismaClient | undefined;

/** Cliente Prisma apuntado a la base de test, compartido por archivo de test. */
export function testPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url: TEST_DATABASE_URL } },
    });
  }
  return client;
}

/**
 * Vacía todas las tablas de datos preservando el esquema.
 * Usa TRUNCATE ... CASCADE en una sola sentencia para no pelear con el orden
 * de las claves foráneas.
 */
export async function resetTestDb(): Promise<void> {
  const prisma = testPrisma();
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map(t => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}
```

- [ ] **Step 5: Crear la config de vitest para tests de base de datos**

Crear `apps/api/vitest.db.config.ts`. `fileParallelism: false` es obligatorio: los archivos truncan tablas y correrían pisándose entre sí.

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/db/**/*.test.ts'],
    setupFiles: ['test/setup-reflect.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
```

- [ ] **Step 6: Crear el script de reset de la base de test**

Crear `apps/api/scripts/reset-test-db.mjs`. Setea `DATABASE_URL` en el proceso hijo en lugar de depender de la sintaxis de variables de entorno del shell, que difiere entre PowerShell y bash.

```javascript
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
    env: { ...process.env, DATABASE_URL: url },
  },
);

process.exit(result.status ?? 1);
```

- [ ] **Step 7: Crear el script de chequeo de deriva**

Crear `apps/api/scripts/drift-check.mjs`. `--exit-code` hace que `migrate diff` devuelva 2 cuando hay diferencias.

```javascript
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
```

- [ ] **Step 8: Agregar los scripts a package.json**

En `apps/api/package.json`, reemplazar el bloque `"scripts"` (líneas 6-19) por:

```json
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
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "node prisma/seed.cjs",
    "prisma:seed:reglamento-data": "node prisma/seeds/build-reglamento-data.mjs",
    "prisma:studio": "prisma studio"
  },
```

- [ ] **Step 9: Correr el test para verificar que pasa**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: PASS, 2 tests. El reset crea `lch_stock_test` si no existe y aplica las 7 migraciones actuales.

- [ ] **Step 10: Commit**

```bash
git add apps/api/vitest.db.config.ts apps/api/scripts/reset-test-db.mjs apps/api/scripts/drift-check.mjs apps/api/test/db/helpers/db.ts apps/api/test/db/smoke.test.ts apps/api/package.json
git commit -m "test(api): agregar suite de tests contra PostgreSQL real y chequeo de deriva

Los tests de test/integration/ usan un mock de Prisma, que acepta
cualquier dato y por lo tanto no puede verificar restricciones de base.
La suite nueva corre contra lch_stock_test."
```
