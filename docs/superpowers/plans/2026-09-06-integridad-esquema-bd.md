# Integridad del esquema de base de datos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que PostgreSQL rechace los datos inválidos que hoy acepta en silencio, sobre una única migración baseline regenerable, verificado con tests contra una base real.

**Architecture:** `prisma/schema.prisma` es la única fuente de verdad. El estado de la base son dos migraciones: una baseline generada íntegramente por `prisma migrate diff` (nunca editada a mano) y una de `CHECK` constraints, que es lo único que el lenguaje de Prisma no puede expresar. Se ejecuta por dominios; cada tanda regenera la baseline, corre `migrate reset` con seeds y tiene que quedar verde antes de pasar a la siguiente.

**Tech Stack:** NestJS 11, Prisma 5.22, PostgreSQL 16 (docker), Vitest 3, TypeScript 5.6, React 18 + Vite (los dos frontends).

**Spec:** `docs/superpowers/specs/2026-09-06-integridad-esquema-bd-design.md`

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

### Task 0: Aislar el trabajo en curso

El repo tiene ~45 archivos modificados y ~20 sin trackear de una sesión anterior (los helpers `persist-mutation.ts`, `catalog-persistence.ts`, las dos migraciones sin commitear y el módulo `settings`). Si no se aísla, cada commit de este plan arrastra trabajo ajeno y el historial queda inservible.

**Files:**
- Ninguno creado o modificado. Solo operaciones de git.

**Interfaces:**
- Consumes: nada.
- Produces: una rama `feat/integridad-esquema-bd` con el árbol de trabajo limpio, partiendo de un commit que contiene todo el trabajo previo.

- [ ] **Step 1: Ver exactamente qué hay pendiente**

Desde la raíz del repo:

```bash
git status --short
git stash list
```

Esperado: la lista de `M` y `??` descrita arriba, y ninguna entrada de stash.

- [ ] **Step 2: Commitear el trabajo en curso tal como está**

No hay que arreglarlo ni revisarlo: solo dejarlo registrado para poder volver a él.

```bash
git add -A
git commit -m "$(cat <<'EOF'
wip: persistencia API-first del admin y módulo settings

Trabajo en curso de una sesión previa, commiteado sin revisar para
partir de un árbol limpio antes de la corrección del esquema de BD.
EOF
)"
```

- [ ] **Step 3: Verificar que el árbol quedó limpio**

```bash
git status --short
```

Esperado: sin salida.

- [ ] **Step 4: Ignorar el directorio de scratch de la ejecución**

Agregar a `.gitignore`, al final:

```gitignore
# Scratch de ejecución por subagentes (briefs, reportes, paquetes de review)
.superpowers/
```

Sin esto, los `git add -A` de las tareas siguientes commitean los archivos de trabajo del proceso de ejecución.

```bash
git add .gitignore
git commit -m "chore: ignorar el scratch de ejecución por subagentes"
```

- [ ] **Step 5: Crear la rama de trabajo**

La rama actual es `feature/clientes-web-publica-cocina-futbol`, no `main`. Ese es el punto de partida y el que se usa como base en todos los diffs de review.

```bash
git checkout -b feat/integridad-esquema-bd
git branch --show-current
git merge-base feature/clientes-web-publica-cocina-futbol HEAD
```

Esperado: la rama es `feat/integridad-esquema-bd`, y el merge-base es el commit creado en el Step 4. Anotar ese hash: es la `MERGE_BASE` de la Task 11.

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

---

### Task 2: Aplastar las 7 migraciones en una baseline generada

Se hace **antes** de cambiar el schema, para que si algo se rompe se sepa que fue el aplastado y no una corrección de esquema. El schema no cambia en esta tarea.

**Files:**
- Create: `apps/api/scripts/generate-baseline.mjs`
- Create: `apps/api/prisma/migrations/20260906120000_baseline/migration.sql` (generado)
- Delete: `apps/api/prisma/migrations/20250618130000_init/`
- Delete: `apps/api/prisma/migrations/20260820120000_optimize_spanish_schema/`
- Delete: `apps/api/prisma/migrations/20260831104500_public_platform_phase_a1/`
- Delete: `apps/api/prisma/migrations/20260901120000_online_menu_web_sponsors/`
- Delete: `apps/api/prisma/migrations/20260902120000_public_auth_db_optimize/`
- Delete: `apps/api/prisma/migrations/20260904120000_ticket_stock_allocations/`
- Delete: `apps/api/prisma/migrations/20260904180000_admin_settings/`
- Modify: `apps/api/package.json` (script `db:baseline`)

**Interfaces:**
- Consumes: `npm run test:db` y `npm run db:drift` de la Task 1.
- Produces: `node scripts/generate-baseline.mjs` — borra y regenera `prisma/migrations/20260906120000_baseline/migration.sql` desde `schema.prisma`. Lo usan todas las tareas de dominio siguientes.

- [ ] **Step 1: Crear el generador de baseline**

Crear `apps/api/scripts/generate-baseline.mjs`. Captura stdout y escribe con `utf8` explícito, en lugar de redirigir con el shell.

```javascript
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
```

- [ ] **Step 2: Agregar el script a package.json**

En `apps/api/package.json`, agregar dentro de `"scripts"`, después de `"db:drift"`:

```json
    "db:baseline": "node scripts/generate-baseline.mjs",
```

- [ ] **Step 3: Borrar las 7 migraciones viejas**

Desde `apps/api`:

```bash
git rm -r prisma/migrations/20250618130000_init prisma/migrations/20260820120000_optimize_spanish_schema prisma/migrations/20260831104500_public_platform_phase_a1 prisma/migrations/20260901120000_online_menu_web_sponsors prisma/migrations/20260902120000_public_auth_db_optimize prisma/migrations/20260904120000_ticket_stock_allocations prisma/migrations/20260904180000_admin_settings
```

- [ ] **Step 4: Generar la baseline**

Desde `apps/api`:

```bash
npm run db:baseline
```

Esperado: `Baseline regenerada: prisma\migrations\20260906120000_baseline\migration.sql (NNNNN bytes)`, con un tamaño de decenas de miles de bytes.

- [ ] **Step 5: Verificar que la baseline no tiene SQL destructivo**

Desde `apps/api`:

```bash
rg -n "^(DELETE|DROP|UPDATE|ALTER TABLE .* RENAME)" prisma/migrations/20260906120000_baseline/migration.sql
```

Esperado: sin salida. Una baseline desde vacío solo crea.

- [ ] **Step 6: Recrear la base de desarrollo desde la baseline**

Desde `apps/api`:

```bash
npx prisma migrate reset --force
```

Esperado: aplica una sola migración (`20260906120000_baseline`) y corre el seed sin errores.

- [ ] **Step 7: Verificar que no hay deriva**

Desde `apps/api`:

```bash
npm run db:drift
```

Esperado: `Sin deriva: schema.prisma y prisma/migrations coinciden.`

Si en cambio reporta deriva, el schema tiene algo que `migrate diff --from-empty` no reproduce. Leer el diff que imprime y corregir el schema antes de seguir; no editar la baseline a mano.

- [ ] **Step 8: Verificar que la suite completa sigue verde**

Desde `apps/api`:

```bash
npm run test:db
npm test
```

Esperado: ambas PASS.

- [ ] **Step 9: Commit**

```bash
git add -A apps/api/prisma/migrations apps/api/scripts/generate-baseline.mjs apps/api/package.json
git commit -m "refactor(db): aplastar 7 migraciones en una baseline generada

La segunda migración estaba escrita a mano con DELETE de huérfanos,
deduplicaciones y renombres de 27 tablas, y otra insertaba datos con
UUIDs hardcodeados que fallan al reaplicarse. La baseline se genera con
prisma migrate diff y no se edita nunca a mano."
```

---

### Task 3: Traducción de errores Prisma a HTTP

Sin esto, las restricciones que agregan las tareas 4 a 8 devuelven errores 500 crudos en lugar de 409 o 400, y el admin no puede distinguir "dato duplicado" de "la API se cayó".

**Files:**
- Create: `apps/api/src/common/prisma-exception.filter.ts`
- Modify: `apps/api/src/common/prisma-errors.ts` (archivo completo, hoy 3 líneas)
- Modify: `apps/api/src/main.ts` (registro del filtro global)
- Modify: `apps/api/src/sales/sales.service.ts:29-31` (quitar la copia local del chequeo P2002)
- Modify: `apps/api/src/football/football.service.ts:217-229` y `:264-274` (catches desnudos)
- Test: `apps/api/test/unit/prisma-errors.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces, desde `src/common/prisma-errors.ts`:
  - `isPrismaUniqueConflict(e: unknown): boolean` (ya existía)
  - `isPrismaForeignKeyViolation(e: unknown): boolean`
  - `isPrismaRecordNotFound(e: unknown): boolean`
  - `PrismaExceptionFilter` desde `src/common/prisma-exception.filter.ts`, registrado con `app.useGlobalFilters()`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/test/unit/prisma-errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  isPrismaUniqueConflict,
  isPrismaForeignKeyViolation,
  isPrismaRecordNotFound,
} from '../../src/common/prisma-errors';

describe('prisma-errors', () => {
  it('reconoce P2002 como conflicto de unicidad', () => {
    expect(isPrismaUniqueConflict({ code: 'P2002' })).toBe(true);
    expect(isPrismaUniqueConflict({ code: 'P2003' })).toBe(false);
  });

  it('reconoce P2003 como violación de clave foránea', () => {
    expect(isPrismaForeignKeyViolation({ code: 'P2003' })).toBe(true);
    expect(isPrismaForeignKeyViolation({ code: 'P2002' })).toBe(false);
  });

  it('reconoce P2025 como registro no encontrado', () => {
    expect(isPrismaRecordNotFound({ code: 'P2025' })).toBe(true);
    expect(isPrismaRecordNotFound({ code: 'P2002' })).toBe(false);
  });

  it('no explota con valores que no son objetos', () => {
    for (const value of [null, undefined, 'P2002', 42]) {
      expect(isPrismaUniqueConflict(value)).toBe(false);
      expect(isPrismaForeignKeyViolation(value)).toBe(false);
      expect(isPrismaRecordNotFound(value)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Desde `apps/api`:

```bash
npx vitest run test/unit/prisma-errors.test.ts
```

Esperado: FAIL. `isPrismaForeignKeyViolation` e `isPrismaRecordNotFound` no existen.

- [ ] **Step 3: Ampliar los helpers**

Reemplazar el contenido completo de `apps/api/src/common/prisma-errors.ts`:

```typescript
function prismaCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** P2002 — violación de una constraint única. */
export function isPrismaUniqueConflict(e: unknown): boolean {
  return prismaCode(e) === 'P2002';
}

/** P2003 — violación de una clave foránea. */
export function isPrismaForeignKeyViolation(e: unknown): boolean {
  return prismaCode(e) === 'P2003';
}

/** P2025 — la operación esperaba un registro que no existe. */
export function isPrismaRecordNotFound(e: unknown): boolean {
  return prismaCode(e) === 'P2025';
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Desde `apps/api`:

```bash
npx vitest run test/unit/prisma-errors.test.ts
```

Esperado: PASS, 4 tests.

- [ ] **Step 5: Crear el filtro global**

Crear `apps/api/src/common/prisma-exception.filter.ts`. Es la red de seguridad para lo que ningún servicio atrapó; los servicios que ya lanzan mensajes de dominio específicos siguen ganando porque lanzan `HttpException` antes de llegar acá.

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const STATUS_BY_CODE: Record<string, { status: number; message: string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'Ya existe un registro con esos datos.',
  },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'El registro referenciado no existe.',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    message: 'El registro no existe.',
  },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = STATUS_BY_CODE[exception.code];

    if (!mapped) {
      this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno de base de datos.',
      });
      return;
    }

    const target = exception.meta?.target;
    this.logger.warn(`Prisma ${exception.code} en ${JSON.stringify(target)}`);

    response.status(mapped.status).json({
      statusCode: mapped.status,
      message: mapped.message,
      prismaCode: exception.code,
      target,
    });
  }
}
```

- [ ] **Step 6: Registrar el filtro en main.ts**

En `apps/api/src/main.ts`, justo después del bloque `app.useGlobalPipes(new ValidationPipe({...}))` que está en las líneas 135-141, agregar:

```typescript
  app.useGlobalFilters(new PrismaExceptionFilter());
```

Y agregar el import al inicio del archivo, junto a los demás imports locales:

```typescript
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
```

- [ ] **Step 7: Quitar la copia local del chequeo P2002 en sales**

En `apps/api/src/sales/sales.service.ts`, borrar la función local de las líneas 29-31 (la que compara `code === 'P2002'`) y usar el helper compartido. Agregar al bloque de imports:

```typescript
import { isPrismaUniqueConflict } from '../common/prisma-errors';
```

Reemplazar cada llamada a la función local por `isPrismaUniqueConflict`. Verificar que no queda ninguna referencia:

```bash
rg -n "P2002" apps/api/src/sales/sales.service.ts
```

Esperado: sin salida.

- [ ] **Step 8: Hacer que los catches de football discriminen por código**

En `apps/api/src/football/football.service.ts`, el bloque de las líneas 217-229 atrapa cualquier error y lo reporta como equipo ya inscripto, incluyendo fallas de conexión. Reemplazarlo por:

```typescript
    try {
      return await this.prisma.equipoInscripcion.create({ data: inscriptionData });
    } catch (e) {
      if (isPrismaUniqueConflict(e)) {
        throw new ConflictException('El equipo ya está inscripto en este torneo');
      }
      throw e;
    }
```

Aplicar el mismo patrón al bloque de `createCaptain` en las líneas 264-274, conservando su mensaje original de conflicto. Agregar el import:

```typescript
import { isPrismaUniqueConflict } from '../common/prisma-errors';
```

Nota: `inscriptionData` es el objeto `data` que el código actual ya construye inline dentro del `create`. Mantener la construcción tal como está; el único cambio es el `catch`.

- [ ] **Step 9: Verificar compilación y suite**

Desde `apps/api`:

```bash
npm run build
npm test
```

Esperado: ambas PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/common/prisma-errors.ts apps/api/src/common/prisma-exception.filter.ts apps/api/src/main.ts apps/api/src/sales/sales.service.ts apps/api/src/football/football.service.ts apps/api/test/unit/prisma-errors.test.ts
git commit -m "feat(api): traducir errores Prisma a códigos HTTP

P2002 a 409, P2003 a 400 y P2025 a 404 mediante un filtro global. Sin
esto, las restricciones que agregan las tandas de esquema devolverían
500 crudos. Los catches desnudos de football dejan de enmascarar
cualquier error como conflicto de unicidad."
```

---

### Task 4: Dominio stock / inventario

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (enums nuevos; `Producto`, `NivelStock`, `ProveedorProducto`, `MovimientoStock`, `ConsumoEmpleado`, `EntradaConteo`, `OrdenCompra`, `ItemOrdenCompra`; borrar `LogConsumo` y `EntradaConsumo`)
- Create: `apps/api/prisma/migrations/20260906120100_constraints/migration.sql`
- Modify: `apps/api/src/stock/stock.service.ts:53` (default de `unit`)
- Modify: `apps/api/src/stock/dto.ts` (validación de `unit`)
- Modify: `apps/web-admin/src/features/inventory/api/inventory-mappers.ts:31` (coerción de `unit`)
- Modify: `apps/web-admin/src/features/inventory/pages/ProductsPage.tsx:218,340,708-717` (selector de unidades)
- Modify: `apps/web-admin/src/features/inventory/pages/OrdersPage.tsx:74-75` (valor heredado `Confirmado`)
- Test: `apps/api/test/db/stock-constraints.test.ts`

**Interfaces:**
- Consumes: `node scripts/generate-baseline.mjs` (Task 2), `testPrisma`/`resetTestDb` (Task 1).
- Produces: enums `UnidadMedida`, `TipoMovimientoStock`, `EstadoOrdenCompra` en el cliente Prisma, importables como `import { UnidadMedida } from '@prisma/client'`. La migración `20260906120100_constraints` que las tareas 5 a 8 amplían.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/test/db/stock-constraints.test.ts`:

```typescript
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
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: FAIL en al menos los tests de stock negativo, tipo de movimiento inventado, unidad inventada, estado de pedido inventado y tablas heredadas. Los de FK y borrado de categoría pueden pasar ya, porque esas restricciones sí existen.

- [ ] **Step 3: Agregar los enums al schema**

En `apps/api/prisma/schema.prisma`, después del bloque `datasource db` (línea 12) y antes de `// ==================== AUTH ====================`, agregar:

```prisma
// ==================== ENUMS ====================

enum UnidadMedida {
  unidades
  kg
  litros
  cajas
}

enum TipoMovimientoStock {
  venta
  devolucion
  venta_anulada
  ajuste_manual
  consumo
  entrada
}

enum EstadoOrdenCompra {
  Pendiente
  Recibido
}
```

- [ ] **Step 4: Aplicar los cambios a los modelos de stock**

En `apps/api/prisma/schema.prisma`:

En `Producto` (línea 66), cambiar el tipo de `unit` y hacer explícita la política de borrado de la categoría:

```prisma
  unit        UnidadMedida @default(unidades)
```

```prisma
  category           Categoria           @relation(fields: [categoryId], references: [id], onDelete: Restrict)
```

Borrar de `Producto` la relación con el catálogo online heredado (línea 80), que desaparece en la Task 6 pero cuyo modelo se elimina acá para no dejar el schema inválido:

```prisma
  productosOnline    ProductoOnline[]
```

En `ProveedorProducto` (después de la línea 126), agregar el índice del FK que falta:

```prisma
  @@index([supplierId])
```

En `MovimientoStock` (línea 972):

```prisma
  type         TipoMovimientoStock
```

En `ConsumoEmpleado` (línea 1003) y `EntradaConteo` (línea 1042):

```prisma
  unit          UnidadMedida @default(unidades)
```

En `OrdenCompra` (línea 1062), y agregar el índice del FK que falta:

```prisma
  status      EstadoOrdenCompra @default(Pendiente)
```

```prisma
  @@index([supplierId])
```

En `ItemOrdenCompra` (línea 1085), hacer explícita la política de borrado:

```prisma
  product       Producto    @relation(fields: [productId], references: [id], onDelete: Restrict)
```

- [ ] **Step 5: Borrar los modelos heredados de consumo**

En `apps/api/prisma/schema.prisma`, borrar el bloque completo de las líneas 1093 a 1127: el comentario `// ==================== CONSUMOS (legacy) ====================` y los modelos `LogConsumo` y `EntradaConsumo`.

Verificar que nada del código los usa:

```bash
rg -n "logConsumo|LogConsumo|entradaConsumo|EntradaConsumo" apps/
```

Esperado: sin salida.

- [ ] **Step 6: Crear la migración de constraints**

Crear `apps/api/prisma/migrations/20260906120100_constraints/migration.sql`. Es el único SQL escrito a mano del proyecto; solo agrega `CHECK`, nunca borra ni modifica datos.

```sql
-- CHECK constraints que el lenguaje de Prisma no puede expresar.
-- Solo aditivo. No incluir DELETE, DROP ni UPDATE en este archivo.

-- Stock
ALTER TABLE "niveles_stock"
  ADD CONSTRAINT "niveles_stock_quantity_no_negativa" CHECK ("quantity" >= 0);
```

- [ ] **Step 7: Regenerar la baseline y recrear las bases**

Desde `apps/api`:

```bash
npm run db:baseline
npx prisma migrate reset --force
```

Esperado: aplica las dos migraciones (`baseline` y `constraints`) y corre el seed.

Si el seed falla porque `inventory.seed.cjs` usa un valor de `unit` que no está en el enum, corregir el seed, no el enum: los valores del enum salen justamente de ese archivo (`unidades`, `kg`, `litros`, `cajas`).

- [ ] **Step 8: Correr los tests para verificar que pasan**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: PASS, incluidos los 10 tests de `stock-constraints.test.ts`.

- [ ] **Step 9: Verificar que no hay deriva**

Desde `apps/api`:

```bash
npm run db:drift
```

Esperado: `Sin deriva: schema.prisma y prisma/migrations coinciden.`

Si reporta deriva señalando las `CHECK` constraints, aplicar el plan de contingencia del spec: mover el contenido de `20260906120100_constraints/migration.sql` a `scripts/apply-constraints.mjs` (que lo ejecute con `prisma db execute --file`), borrar la carpeta de migración, agregar el script `db:constraints` a `package.json`, encadenarlo en `test:db` después del reset, y documentarlo en `docs/RUNBOOK.md`.

- [ ] **Step 10: Adaptar el backend al tipo de `unit`**

En `apps/api/src/stock/stock.service.ts:53`, el default en texto deja de tipar:

```typescript
          unit: dto.unit ?? UnidadMedida.unidades,
```

Agregar el import:

```typescript
import { UnidadMedida } from '@prisma/client';
```

En `apps/api/src/stock/dto.ts`, en las clases `CreateProductDto` y `UpdateProductDto`, reemplazar la validación de `unit` por una restringida al enum:

```typescript
  @IsOptional()
  @IsEnum(UnidadMedida)
  unit?: UnidadMedida;
```

Agregar los imports que falten en ese archivo:

```typescript
import { IsEnum } from 'class-validator';
import { UnidadMedida } from '@prisma/client';
```

- [ ] **Step 11: Corregir la pérdida de la unidad en el mapper del admin**

En `apps/web-admin/src/features/inventory/api/inventory-mappers.ts:31`, la coerción a dos valores hace que un producto en `cajas` o `litros` se muestre como `unidades`. Reemplazar la línea que fuerza el tipo por el paso directo del valor:

```typescript
    unit: api.unit,
```

Y ajustar el tipo del campo `unit` en la interfaz local de producto del admin, donde hoy sea `'kg' | 'unidades'`, a:

```typescript
  unit: 'unidades' | 'kg' | 'litros' | 'cajas';
```

Aplicar el mismo tipo en `apps/web-admin/src/features/sales/pos/VentasPosContext.tsx:74` y borrar la coerción de la línea 789:

```typescript
        unit: ing.unit,
```

- [ ] **Step 12: Ampliar el selector de unidades en la UI**

En `apps/web-admin/src/features/inventory/pages/ProductsPage.tsx`, el formulario ofrece solo dos botones (líneas 708-717). Reemplazar ese par de botones por un mapeo sobre las cuatro unidades:

```tsx
          {(['unidades', 'kg', 'litros', 'cajas'] as const).map(u => (
            <button
              key={u}
              type="button"
              onClick={() => setForm(p => ({ ...p, unit: u }))}
              className={`p-3 rounded-lg border-2 text-left transition-all ${form.unit === u ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              {UNIT_LABELS[u]}
            </button>
          ))}
```

Agregar cerca de la cabecera del archivo, junto a las demás constantes de módulo:

```tsx
const UNIT_LABELS = {
  unidades: 'Unidades',
  kg: 'Kilogramos',
  litros: 'Litros',
  cajas: 'Cajas',
} as const;
```

Y en las dos vistas de detalle (líneas 218 y 340), reemplazar el ternario `product.unit === 'kg' ? 'Kilogramos' : 'Unidades'` por:

```tsx
{UNIT_LABELS[product.unit]}
```

El cálculo de paso decimal de la línea 787 sigue siendo correcto: `kg` admite decimales y el resto son enteros. Extenderlo a `litros`, que también es fraccionable:

```tsx
                  step={form.unit === 'kg' || form.unit === 'litros' ? 0.001 : 1}
```

Y en la línea 780:

```tsx
                    const parsed = form.unit === 'kg' || form.unit === 'litros' ? parseFloat(raw) : parseInt(raw, 10);
```

- [ ] **Step 13: Quitar el estado heredado `Confirmado` del admin**

En `apps/web-admin/src/features/inventory/pages/OrdersPage.tsx:74-75`, `'Confirmado'` no existe en la base y se mapea a `'Recibido'`. Reemplazar el bloque por:

```tsx
    if (status === 'Pendiente' || status === 'Recibido') {
      setStatusFilter(status);
    }
```

- [ ] **Step 14: Verificar compilación y suites**

Desde la raíz del repo:

```bash
npm test
```

Desde `apps/api`:

```bash
npm run build
npm run test:db
```

Desde `apps/web-admin`:

```bash
npm run build
```

Esperado: todas PASS.

- [ ] **Step 15: Commit**

```bash
git add -A apps/api/prisma apps/api/src/stock apps/api/test/db apps/web-admin/src/features/inventory apps/web-admin/src/features/sales/pos/VentasPosContext.tsx
git commit -m "feat(db): restricciones de integridad en el dominio de stock

Enums UnidadMedida, TipoMovimientoStock y EstadoOrdenCompra; CHECK de
cantidad no negativa; índices en supplierId de proveedores_productos y
ordenes_compra. Elimina logs_consumo y entradas_consumo, que no tenían
FK a producto ni depósito. Corrige el mapper del admin, que mostraba
como 'unidades' cualquier producto en cajas o litros."
```

---

### Task 5: Dominio ventas / POS

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (enums; `ProductoVenta`, `CategoriaVenta`, `TicketVenta`, `ItemTicketVenta`, `OrdenCocina`, `ItemOrdenCocina`, `MesaVenta`, `CuentaEquipo`, `Impresora`)
- Modify: `apps/api/prisma/migrations/20260906120100_constraints/migration.sql` (agregar CHECKs)
- Modify: `apps/api/src/sales/sales.service.ts:693-736` (categoría como FK) y borrar `:892-898` (`findAllTables`)
- Modify: `apps/api/src/sales/dto.ts:101,161` (`category` → `categoriaVentaId`)
- Modify: `apps/api/src/online/online.service.ts:276,282,296,317,350` (uso de `category`)
- Modify: `apps/api/prisma/seeds/cantina.seed.cjs` (crear `CategoriaVenta` y referenciarla)
- Modify: `apps/web-admin/src/features/sales/api/sales-mappers.ts`, `use-sales-state.ts`, `components/SalesCategorySelect.tsx`
- Test: `apps/api/test/db/sales-constraints.test.ts`

**Interfaces:**
- Consumes: `UnidadMedida` y la migración de constraints (Task 4).
- Produces: enums `EstadoTicket`, `OrigenTicket`, `TipoProductoVenta`, `EstadoOrdenCocina`, `EstadoMesa`, `EstadoCuentaEquipo`. `ProductoVenta.categoriaVentaId: string` reemplaza a `ProductoVenta.category: string` en toda la API y en los DTOs.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/test/db/sales-constraints.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

async function seedMenu() {
  const cocina = await prisma.cocina.create({ data: { name: 'Parrilla', emoji: '🔥' } });
  const categoria = await prisma.categoriaVenta.create({ data: { name: 'Comidas' } });
  const producto = await prisma.productoVenta.create({
    data: {
      name: 'Hamburguesa',
      categoriaVentaId: categoria.id,
      kitchenId: cocina.id,
      price: 8500,
    },
  });
  return { cocina, categoria, producto };
}

describe('restricciones de ventas', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rechaza un producto de venta con una categoría que no existe', async () => {
    const cocina = await prisma.cocina.create({ data: { name: 'Cocina' } });
    await expect(
      prisma.productoVenta.create({
        data: {
          name: 'X',
          categoriaVentaId: '00000000-0000-4000-8000-000000000099',
          kitchenId: cocina.id,
          price: 100,
        },
      }),
    ).rejects.toThrow();
  });

  it('impide borrar una categoría de venta que tiene productos', async () => {
    const { categoria } = await seedMenu();
    await expect(
      prisma.categoriaVenta.delete({ where: { id: categoria.id } }),
    ).rejects.toThrow();
  });

  it('rechaza un precio negativo en el menú', async () => {
    const cocina = await prisma.cocina.create({ data: { name: 'Barra' } });
    const categoria = await prisma.categoriaVenta.create({ data: { name: 'Bebidas' } });
    await expect(
      prisma.productoVenta.create({
        data: { name: 'Y', categoriaVentaId: categoria.id, kitchenId: cocina.id, price: -1 },
      }),
    ).rejects.toThrow();
  });

  it('rechaza un estado de ticket inventado', async () => {
    const usuario = await prisma.usuario.create({
      data: { username: 'op', name: 'Op', role: 'Vendedor', password: 'x' },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "tickets_venta" ("id", "number", "status", "total", "operatorId")
         VALUES (gen_random_uuid()::text, 1, 'reembolsado', 100, $1)`,
        usuario.id,
      ),
    ).rejects.toThrow();
  });

  it('rechaza un total de ticket negativo', async () => {
    const usuario = await prisma.usuario.create({
      data: { username: 'op2', name: 'Op', role: 'Vendedor', password: 'x' },
    });
    await expect(
      prisma.ticketVenta.create({
        data: { number: 2, total: -5, operatorId: usuario.id },
      }),
    ).rejects.toThrow();
  });

  it('rechaza una cantidad de línea en cero', async () => {
    const { producto } = await seedMenu();
    const usuario = await prisma.usuario.create({
      data: { username: 'op3', name: 'Op', role: 'Vendedor', password: 'x' },
    });
    const ticket = await prisma.ticketVenta.create({
      data: { number: 3, total: 0, operatorId: usuario.id },
    });
    await expect(
      prisma.itemTicketVenta.create({
        data: {
          ticketId: ticket.id,
          salesProductId: producto.id,
          name: 'Hamburguesa',
          unitPrice: 8500,
          quantity: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it('rechaza una mesa apuntando a un ticket que no existe', async () => {
    await expect(
      prisma.mesaVenta.create({
        data: {
          name: 'Mesa 1',
          status: 'ocupada',
          currentOrderId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    ).rejects.toThrow();
  });

  it('rechaza un estado de mesa inventado', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "mesas_venta" ("id", "name", "status", "updatedAt")
         VALUES (gen_random_uuid()::text, 'Mesa 2', 'sucia', now())`,
      ),
    ).rejects.toThrow();
  });

  it('rechaza dos impresoras con el mismo nombre', async () => {
    await prisma.impresora.create({ data: { name: 'Barra', type: 'termica', ip: '10.0.0.1' } });
    await expect(
      prisma.impresora.create({ data: { name: 'Barra', type: 'termica', ip: '10.0.0.2' } }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: FAIL. `categoriaVentaId` todavía no existe en el modelo, así que los tests de ventas fallan al compilar la llamada.

- [ ] **Step 3: Agregar los enums de ventas al schema**

En `apps/api/prisma/schema.prisma`, dentro del bloque de enums creado en la Task 4, agregar:

```prisma
enum EstadoTicket {
  emitido
  anulado
  devuelto
}

enum OrigenTicket {
  pos
  online
}

enum TipoProductoVenta {
  simple
  promo
}

enum EstadoOrdenCocina {
  pending
  preparing
  ready
  delivered
}

enum EstadoMesa {
  libre
  ocupada
}

enum EstadoCuentaEquipo {
  abierta
  cerrada
}
```

- [ ] **Step 4: Convertir la categoría del menú en un FK**

En `apps/api/prisma/schema.prisma`, en `ProductoVenta`, reemplazar la línea 176 por:

```prisma
  categoriaVentaId String   @map("categoria_venta_id")
```

Cambiar el tipo de `kind` (línea 180):

```prisma
  kind           TipoProductoVenta @default(simple)
```

Hacer explícita la política de borrado de la cocina (línea 195) y agregar la relación con la categoría:

```prisma
  kitchen        Cocina         @relation(fields: [kitchenId], references: [id], onDelete: Restrict)
  categoriaVenta CategoriaVenta @relation(fields: [categoriaVentaId], references: [id], onDelete: Restrict)
```

Reemplazar el índice de la línea 205 (que indexaba `name`) y agregar el del FK nuevo:

```prisma
  @@index([categoriaVentaId])
```

En `CategoriaVenta` (líneas 1142-1151), agregar la relación inversa antes de `@@map`:

```prisma
  productos ProductoVenta[]
```

- [ ] **Step 5: Aplicar el resto de los cambios de ventas**

En `apps/api/prisma/schema.prisma`:

`TicketVenta` (líneas 247 y 252):

```prisma
  status         EstadoTicket @default(emitido)
```

```prisma
  origen          OrigenTicket @default(pos)
```

`TicketVenta.operator` (línea 255), explícito:

```prisma
  operator      Usuario           @relation("TicketsOperador", fields: [operatorId], references: [id], onDelete: Restrict)
```

`ItemTicketVenta.salesProduct` (línea 279), explícito:

```prisma
  salesProduct ProductoVenta @relation(fields: [salesProductId], references: [id], onDelete: Restrict)
```

`OrdenCocina` (línea 324) y sus relaciones (líneas 332-333):

```prisma
  status          EstadoOrdenCocina @default(pending)
```

```prisma
  ticket        TicketVenta       @relation(fields: [ticketId], references: [id], onDelete: Restrict)
  kitchen       Cocina            @relation(fields: [kitchenId], references: [id], onDelete: Restrict)
```

`ItemOrdenCocina.salesProduct` (línea 355), explícito:

```prisma
  salesProduct ProductoVenta @relation(fields: [salesProductId], references: [id], onDelete: Restrict)
```

`MesaVenta` (líneas 1168-1177) completo, con el FK real al ticket y el nombre único:

```prisma
model MesaVenta {
  id             String     @id @default(uuid())
  name           String     @unique
  status         EstadoMesa @default(libre)
  currentOrderId String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  currentOrder TicketVenta? @relation(fields: [currentOrderId], references: [id], onDelete: SetNull)

  @@index([currentOrderId])
  @@map("mesas_venta")
}
```

Agregar la relación inversa en `TicketVenta`, antes de su `@@index`:

```prisma
  mesas         MesaVenta[]
```

`CuentaEquipo` (línea 1183):

```prisma
  status    EstadoCuentaEquipo @default(abierta)
```

`Impresora` (línea 1155):

```prisma
  name       String   @unique
```

- [ ] **Step 6: Ampliar la migración de constraints**

Agregar al final de `apps/api/prisma/migrations/20260906120100_constraints/migration.sql`:

```sql
-- Ventas
ALTER TABLE "productos_venta"
  ADD CONSTRAINT "productos_venta_price_no_negativo" CHECK ("price" >= 0);

ALTER TABLE "tickets_venta"
  ADD CONSTRAINT "tickets_venta_total_no_negativo" CHECK ("total" >= 0);

ALTER TABLE "items_ticket_venta"
  ADD CONSTRAINT "items_ticket_venta_unitPrice_no_negativo" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "items_ticket_venta_quantity_positiva" CHECK ("quantity" > 0);
```

- [ ] **Step 7: Sembrar las categorías de venta en el seed de cantina**

En `apps/api/prisma/seeds/cantina.seed.cjs`, las categorías del POS son las mismas dos que las web (`Comidas` y `Bebidas`, líneas 2-8). Agregar después del bloque de `WEB_CATEGORIES` (línea 14):

```javascript
const SALES_CATEGORIES = [
  { name: 'Comidas', emoji: '🍔', sortOrder: 0 },
  { name: 'Bebidas', emoji: '🥤', sortOrder: 1 },
];
```

Dentro de `seedCantinaPublica`, después del bucle de `WEB_CATEGORIES` (línea 99), agregar:

```javascript
  const salesCategoryMap = new Map();
  for (const cat of SALES_CATEGORIES) {
    const row = await prisma.categoriaVenta.upsert({
      where: { name: cat.name },
      update: { emoji: cat.emoji, sortOrder: cat.sortOrder },
      create: cat,
    });
    salesCategoryMap.set(cat.name, row.id);
  }
```

Y en el `upsert` de `productoVenta` (líneas 115-139), reemplazar las dos apariciones de `category: item.category` por:

```javascript
        categoriaVentaId: salesCategoryMap.get(item.category),
```

- [ ] **Step 8: Adaptar el servicio y los DTOs de ventas**

En `apps/api/src/sales/dto.ts`, en `CreateSalesProductDto` reemplazar el campo de la línea 101:

```typescript
  @IsUUID()
  categoriaVentaId: string;
```

Y en `UpdateSalesProductDto` la línea 161:

```typescript
  @IsOptional()
  @IsUUID()
  categoriaVentaId?: string;
```

En `apps/api/src/sales/sales.service.ts`, en la firma de `createSalesProduct` (línea 693) y en `updateSalesProduct` (línea 736), reemplazar `category: string` por `categoriaVentaId: string` (y su variante opcional), y en los objetos `data` (líneas 705 y 724) reemplazar `category: data.category` por:

```typescript
          categoriaVentaId: data.categoriaVentaId,
```

- [ ] **Step 9: Borrar findAllTables**

En `apps/api/src/sales/sales.service.ts`, borrar las líneas 892-898 completas: el comentario `// ============ Tables ============` y el método `findAllTables()`, que consulta `depositos` e inventa el estado `'libre'`. Es código muerto: ninguna ruta lo expone y el admin usa `/settings/tables`.

Verificar:

```bash
rg -n "findAllTables" apps/
```

Esperado: sin salida.

- [ ] **Step 10: Adaptar online.service.ts**

En `apps/api/src/online/online.service.ts`, reemplazar `category` por `categoriaVentaId` en el `orderBy` de la línea 276, en las firmas de las líneas 282 y 317, y en los objetos de las líneas 296 y 350:

```typescript
      orderBy: [{ webSortOrder: 'asc' }, { categoriaVentaId: 'asc' }, { name: 'asc' }],
```

- [ ] **Step 11: Adaptar el frontend del admin**

En `apps/web-admin/src/features/sales/api/sales-mappers.ts`, reemplazar el mapeo de `category` por `categoriaVentaId` en ambas direcciones (API → UI y UI → API), conservando el nombre `category` en el tipo de UI solo si ya se usa así en los componentes; en caso contrario renombrarlo a `categoriaVentaId` de forma consistente en `use-sales-state.ts` y en `components/SalesCategorySelect.tsx`, de modo que el selector envíe el id de la categoría y no su nombre.

Verificar que no queda ningún envío del nombre de categoría al backend:

```bash
rg -n "category:" apps/web-admin/src/features/sales
```

Esperado: solo apariciones que refieran al id (`categoriaVentaId`) o a etiquetas de presentación, ninguna que arme el cuerpo de un POST o PUT a `/sales/products`.

- [ ] **Step 12: Regenerar, resetear y correr todo**

Desde `apps/api`:

```bash
npm run db:baseline
npx prisma migrate reset --force
npm run db:drift
npm run test:db
npm test
npm run build
```

Desde `apps/web-admin`:

```bash
npm run build
```

Esperado: todas PASS y sin deriva.

- [ ] **Step 13: Commit**

```bash
git add -A apps/api apps/web-admin
git commit -m "feat(db): restricciones de integridad en el dominio de ventas

ProductoVenta.category pasa de string libre a FK contra CategoriaVenta:
renombrar una categoría dejaba a los productos apuntando al texto viejo.
Enums de estado de ticket, origen, tipo de producto, orden de cocina,
mesa y cuenta de equipo. MesaVenta.currentOrderId pasa a FK real contra
el ticket. Elimina findAllTables, que devolvía depósitos como mesas."
```

---

### Task 6: Dominio online / cantina

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (borrar `ProductoOnline`; enums de `PedidoPublico` y `Patrocinador`)
- Modify: `apps/api/prisma/migrations/20260906120100_constraints/migration.sql`
- Delete: `apps/api/src/online-catalog/` (4 archivos)
- Modify: `apps/api/src/app.module.ts` (quitar `OnlineCatalogModule`)
- Modify: `apps/web-admin/src/app/api/client.ts`, `apps/web-admin/src/app/api/adapters.ts`
- Modify: `apps/web-public/src/app/api/client.ts`, `apps/web-public/src/app/api/adapters.ts`
- Modify: `apps/api/test/unit/adapter-integration.test.ts`
- Modify: `apps/api/prisma/seeds/online-demo.seed.cjs`
- Test: `apps/api/test/db/online-constraints.test.ts`

**Interfaces:**
- Consumes: los enums y la migración de constraints de las tareas 4 y 5.
- Produces: enums `EstadoPedidoPublico`, `PlacementPatrocinador`, `TipoMedioPatrocinador`. Desaparece la ruta `/online-catalog/*` de la API y de los dos clientes.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/test/db/online-constraints.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

async function seedCuenta() {
  return prisma.cuentaPublica.create({
    data: { email: 'socio@lch.test', passwordHash: 'hash' },
  });
}

describe('restricciones de cantina online', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rechaza un estado de pedido inventado', async () => {
    const cuenta = await seedCuenta();
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "pedidos_publicos" ("id", "cuentaPublicaId", "status", "total", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'en_camino', 100, now())`,
        cuenta.id,
      ),
    ).rejects.toThrow();
  });

  it('acepta los seis estados de pedido válidos', async () => {
    const cuenta = await seedCuenta();
    const estados = ['pendiente_pago', 'pagado', 'en_cocina', 'listo', 'retirado', 'cancelado'] as const;
    for (const status of estados) {
      const pedido = await prisma.pedidoPublico.create({
        data: { cuentaPublicaId: cuenta.id, status, total: 100 },
      });
      expect(pedido.status).toBe(status);
    }
  });

  it('rechaza un total de pedido negativo', async () => {
    const cuenta = await seedCuenta();
    await expect(
      prisma.pedidoPublico.create({
        data: { cuentaPublicaId: cuenta.id, total: -1 },
      }),
    ).rejects.toThrow();
  });

  it('rechaza dos patrocinadores con el mismo nombre', async () => {
    await prisma.patrocinador.create({ data: { name: 'Sponsor', imageUrl: '/a.png' } });
    await expect(
      prisma.patrocinador.create({ data: { name: 'Sponsor', imageUrl: '/b.png' } }),
    ).rejects.toThrow();
  });

  it('rechaza un placement de patrocinador inventado', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "patrocinadores" ("id", "name", "imageUrl", "placement", "updatedAt")
         VALUES (gen_random_uuid()::text, 'S2', '/c.png', 'popup', now())`,
      ),
    ).rejects.toThrow();
  });

  it('ya no existe la tabla del catálogo online heredado', async () => {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'productos_online'
    `;
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: FAIL en los tests de estado inventado, total negativo, nombre duplicado, placement inventado y tabla heredada.

- [ ] **Step 3: Agregar los enums al schema**

En el bloque de enums de `apps/api/prisma/schema.prisma`, agregar:

```prisma
enum EstadoPedidoPublico {
  pendiente_pago
  pagado
  en_cocina
  listo
  retirado
  cancelado
}

enum PlacementPatrocinador {
  banner
  sidebar
  footer
}

enum TipoMedioPatrocinador {
  image
  video
}
```

- [ ] **Step 4: Aplicar los cambios de schema**

En `apps/api/prisma/schema.prisma`:

Borrar el bloque completo de las líneas 405-427: el comentario `// ==================== CATÁLOGO ONLINE ====================` y el modelo `ProductoOnline`. (Su relación inversa en `Producto` ya se eliminó en la Task 4.)

`Patrocinador` (líneas 386-390):

```prisma
  name        String                @unique
  imageUrl    String
  placement   PlacementPatrocinador @default(banner)
  bannerLabel String?               @map("banner_label")
  mediaType   TipoMedioPatrocinador @default(image) @map("tipo_medio")
```

`PedidoPublico` (línea 893) y su relación con la cuenta (línea 900):

```prisma
  status          EstadoPedidoPublico @default(pendiente_pago)
```

```prisma
  cuentaPublica CuentaPublica       @relation(fields: [cuentaPublicaId], references: [id], onDelete: Restrict)
```

- [ ] **Step 5: Ampliar la migración de constraints**

Agregar al final de `apps/api/prisma/migrations/20260906120100_constraints/migration.sql`:

```sql
-- Cantina online
ALTER TABLE "pedidos_publicos"
  ADD CONSTRAINT "pedidos_publicos_total_no_negativo" CHECK ("total" >= 0);

ALTER TABLE "items_pedido_publico"
  ADD CONSTRAINT "items_pedido_publico_unitPrice_no_negativo" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "items_pedido_publico_quantity_positiva" CHECK ("quantity" > 0);
```

- [ ] **Step 6: Borrar el módulo online-catalog**

Desde la raíz del repo:

```bash
git rm -r apps/api/src/online-catalog
```

En `apps/api/src/app.module.ts`, borrar el import de `OnlineCatalogModule` y su entrada en el array `imports`.

- [ ] **Step 7: Quitar el catálogo online de los dos frontends**

En `apps/web-admin/src/app/api/client.ts` y `apps/web-public/src/app/api/client.ts`, borrar el objeto de cliente que apunta a `/online-catalog/...` junto con sus tipos exclusivos. En `apps/web-admin/src/app/api/adapters.ts` y `apps/web-public/src/app/api/adapters.ts`, borrar el hook o adaptador que lo consumía y cualquier import huérfano. En `apps/api/test/unit/adapter-integration.test.ts`, borrar los casos que ejercitan esas rutas.

Verificar que no queda ninguna referencia:

```bash
rg -n "online-catalog|onlineCatalog|OnlineCatalog|productoOnline|ProductoOnline" apps/
```

Esperado: sin salida.

- [ ] **Step 8: Quitar el catálogo online del seed de demo**

En `apps/api/prisma/seeds/online-demo.seed.cjs`, borrar el bloque que crea filas de `productoOnline`. No tocar todavía el ticket con `number: contador + 50`: eso es la Task 9.

- [ ] **Step 9: Actualizar la documentación**

En `docs/ARCHITECTURE.md` y `docs/RUNBOOK.md`, borrar las menciones al módulo `online-catalog` y a `productos_online`.

```bash
rg -n "online-catalog|productos_online" docs/
```

Esperado: sin salida.

- [ ] **Step 10: Regenerar, resetear y correr todo**

Desde `apps/api`:

```bash
npm run db:baseline
npx prisma migrate reset --force
npm run db:drift
npm run test:db
npm test
npm run build
```

Desde `apps/web-admin` y desde `apps/web-public`:

```bash
npm run build
```

Esperado: todas PASS y sin deriva.

- [ ] **Step 11: Commit**

```bash
git add -A apps docs
git commit -m "feat(db): restricciones de cantina online y baja del catálogo heredado

Elimina ProductoOnline y el módulo online-catalog completo: era una
tienda paralela sin integración con stock ni con el flujo de cantina,
que hoy funciona con productos_venta y categorias_web. Enums de estado
de pedido, placement y tipo de medio de patrocinador."
```

---

### Task 7: Dominio fútbol

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (enums; `Persona`, `CuentaPublica`, `Campeonato`, `CategoriaConfig`, `EquipoInscripcion`, `InscripcionJugador`, `PartidoFutbol`, `EventoPartido`, `Suspension`, `ProductoVentaFiltro`, `ReglamentoArticulo`, `ReglamentoRegla`)
- Modify: `apps/api/prisma/migrations/20260906120100_constraints/migration.sql`
- Modify: `apps/api/src/football/football.service.ts`, `apps/api/src/football/dto.ts` (tipos de enum)
- Test: `apps/api/test/db/football-constraints.test.ts`

**Interfaces:**
- Consumes: la migración de constraints de las tareas 4 a 6.
- Produces: enums `EstadoPartido`, `TipoEventoPartido`, `GeneroCategoria`, `RolPlantel`, `RolCuentaPublica`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/test/db/football-constraints.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

async function seedTorneo() {
  const temporada = await prisma.temporada.create({
    data: { nombre: '2026', anio: 2026, inicio: new Date(), fin: new Date() },
  });
  const campeonato = await prisma.campeonato.create({
    data: { temporadaId: temporada.id, nombre: 'Apertura' },
  });
  const categoria = await prisma.categoriaConfig.create({
    data: {
      codigo: 'hombres_libre_a',
      nombre: 'Libre A',
      genero: 'hombres',
      maxPlantel: 18,
      minJugadoresInicio: 7,
    },
  });
  const torneo = await prisma.torneo.create({
    data: { campeonatoId: campeonato.id, categoriaId: categoria.id, nombre: 'Libre A' },
  });
  const equipo = await prisma.equipoFutbol.create({ data: { name: 'Los Pibes' } });
  const inscripcion = await prisma.equipoInscripcion.create({
    data: { torneoId: torneo.id, equipoId: equipo.id },
  });
  return { torneo, equipo, inscripcion };
}

describe('restricciones de fútbol', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rechaza dos personas con el mismo email', async () => {
    await prisma.persona.create({
      data: { dni: '30111222', nombre: 'A', apellido: 'A', email: 'dup@lch.test' },
    });
    await expect(
      prisma.persona.create({
        data: { dni: '30111223', nombre: 'B', apellido: 'B', email: 'dup@lch.test' },
      }),
    ).rejects.toThrow();
  });

  it('permite varias personas sin email', async () => {
    await prisma.persona.create({ data: { dni: '30111224', nombre: 'C', apellido: 'C' } });
    const segunda = await prisma.persona.create({
      data: { dni: '30111225', nombre: 'D', apellido: 'D' },
    });
    expect(segunda.email).toBeNull();
  });

  it('rechaza dos jugadores con la misma camiseta en el mismo equipo', async () => {
    const { torneo, inscripcion } = await seedTorneo();
    const p1 = await prisma.persona.create({ data: { dni: '40000001', nombre: 'E', apellido: 'E' } });
    const p2 = await prisma.persona.create({ data: { dni: '40000002', nombre: 'F', apellido: 'F' } });
    await prisma.inscripcionJugador.create({
      data: {
        personaId: p1.id,
        torneoId: torneo.id,
        equipoInscripcionId: inscripcion.id,
        numeroCamiseta: 10,
      },
    });
    await expect(
      prisma.inscripcionJugador.create({
        data: {
          personaId: p2.id,
          torneoId: torneo.id,
          equipoInscripcionId: inscripcion.id,
          numeroCamiseta: 10,
        },
      }),
    ).rejects.toThrow();
  });

  it('rechaza una cuenta pública sin ningún método de autenticación', async () => {
    await expect(
      prisma.cuentaPublica.create({ data: { email: 'sinauth@lch.test' } }),
    ).rejects.toThrow();
  });

  it('acepta una cuenta pública con solo googleId', async () => {
    const cuenta = await prisma.cuentaPublica.create({
      data: { email: 'google@lch.test', googleId: 'g-123' },
    });
    expect(cuenta.googleId).toBe('g-123');
  });

  it('rechaza un estado de partido inventado', async () => {
    const { torneo, equipo } = await seedTorneo();
    const rival = await prisma.equipoFutbol.create({ data: { name: 'Rival' } });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "partidos_futbol" ("id", "homeTeamId", "awayTeamId", "date", "status", "torneoId", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, now(), 'aplazado', $3, now())`,
        equipo.id,
        rival.id,
        torneo.id,
      ),
    ).rejects.toThrow();
  });

  it('rechaza goles negativos', async () => {
    const { torneo, equipo } = await seedTorneo();
    const rival = await prisma.equipoFutbol.create({ data: { name: 'Rival2' } });
    await expect(
      prisma.partidoFutbol.create({
        data: {
          homeTeamId: equipo.id,
          awayTeamId: rival.id,
          date: new Date(),
          torneoId: torneo.id,
          homeGoals: -1,
          awayGoals: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it('rechaza un tipo de evento inventado', async () => {
    const { torneo, equipo } = await seedTorneo();
    const rival = await prisma.equipoFutbol.create({ data: { name: 'Rival3' } });
    const persona = await prisma.persona.create({
      data: { dni: '40000003', nombre: 'G', apellido: 'G' },
    });
    const partido = await prisma.partidoFutbol.create({
      data: { homeTeamId: equipo.id, awayTeamId: rival.id, date: new Date(), torneoId: torneo.id },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "eventos_partido" ("id", "partidoId", "personaId", "tipo")
         VALUES (gen_random_uuid()::text, $1, $2, 'penal_errado')`,
        partido.id,
        persona.id,
      ),
    ).rejects.toThrow();
  });

  it('rechaza una suspensión originada en un partido que no existe', async () => {
    const persona = await prisma.persona.create({
      data: { dni: '40000004', nombre: 'H', apellido: 'H' },
    });
    await expect(
      prisma.suspension.create({
        data: {
          personaId: persona.id,
          motivo: 'roja',
          origenPartidoId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: FAIL en email duplicado, camiseta duplicada, cuenta sin autenticación, estado inventado, goles negativos, tipo de evento inventado y suspensión huérfana.

- [ ] **Step 3: Agregar los enums al schema**

En el bloque de enums de `apps/api/prisma/schema.prisma`, agregar:

```prisma
enum EstadoPartido {
  pendiente
  jugado
  suspendido
  wo
}

enum TipoEventoPartido {
  gol
  asistencia
  amarilla
  roja
  azul
  doble_amarilla
  expulsion_directa
}

enum GeneroCategoria {
  hombres
  mujeres
}

enum RolPlantel {
  jugador
  capitan
  subcapitan
}

enum RolCuentaPublica {
  usuario
  seguidor
  jugador
  capitan
}
```

- [ ] **Step 4: Aplicar los cambios de schema**

En `apps/api/prisma/schema.prisma`:

`Campeonato` — agregar el índice del FK que falta (después de la línea 462):

```prisma
  @@index([temporadaId])
```

`CategoriaConfig` (línea 470) y su índice de FK:

```prisma
  genero             GeneroCategoria
```

```prisma
  @@index([grupoCanchasId])
```

`Torneo.categoria` (línea 496), explícito:

```prisma
  categoria     CategoriaConfig      @relation(fields: [categoriaId], references: [id], onDelete: Restrict)
```

`EquipoInscripcion.equipo` (línea 557) más su índice:

```prisma
  equipo       EquipoFutbol         @relation(fields: [equipoId], references: [id], onDelete: Restrict)
```

```prisma
  @@index([equipoId])
```

`Persona.email` (línea 576) — pasa a único, y se elimina el `@@index([email])` de la línea 589 porque el único ya provee el índice:

```prisma
  email              String?   @unique
```

`CuentaPublica.rol` (línea 600):

```prisma
  rol             RolCuentaPublica @default(usuario)
```

`InscripcionJugador.rolPlantel` (línea 649) y el único nuevo:

```prisma
  rolPlantel          RolPlantel @default(jugador)
```

```prisma
  @@unique([equipoInscripcionId, numeroCamiseta])
```

`PartidoFutbol.status` (línea 754), las relaciones con los equipos (líneas 771-772) más sus índices, y el FK de suspensión:

```prisma
  status            EstadoPartido @default(pendiente)
```

```prisma
  homeTeam        EquipoFutbol       @relation("HomeTeam", fields: [homeTeamId], references: [id], onDelete: Restrict)
  awayTeam        EquipoFutbol       @relation("AwayTeam", fields: [awayTeamId], references: [id], onDelete: Restrict)
```

```prisma
  suspensionesOrigen Suspension[] @relation("SuspensionOrigen")
```

```prisma
  @@index([homeTeamId])
  @@index([awayTeamId])
```

`EventoPartido.tipo` (línea 793):

```prisma
  tipo        TipoEventoPartido
```

`Suspension` — el string suelto pasa a FK real (línea 814) con su relación e índice:

```prisma
  origenPartido PartidoFutbol? @relation("SuspensionOrigen", fields: [origenPartidoId], references: [id], onDelete: SetNull)
```

```prisma
  @@index([origenPartidoId])
```

`ProductoVentaFiltro` — índice inverso que falta (antes de `@@map`, línea 170):

```prisma
  @@index([filtroWebId])
```

`ReglamentoArticulo` (antes de `@@map`, línea 856) y `ReglamentoRegla` (antes de `@@map`, línea 885):

```prisma
  @@index([apartadoId])
```

```prisma
  @@index([anexoId])
```

- [ ] **Step 5: Ampliar la migración de constraints**

Agregar al final de `apps/api/prisma/migrations/20260906120100_constraints/migration.sql`:

```sql
-- Fútbol
ALTER TABLE "partidos_futbol"
  ADD CONSTRAINT "partidos_futbol_homeGoals_no_negativos"
    CHECK ("homeGoals" IS NULL OR "homeGoals" >= 0),
  ADD CONSTRAINT "partidos_futbol_awayGoals_no_negativos"
    CHECK ("awayGoals" IS NULL OR "awayGoals" >= 0);

ALTER TABLE "cuentas_publicas"
  ADD CONSTRAINT "cuentas_publicas_con_metodo_de_auth"
    CHECK ("googleId" IS NOT NULL OR "password_hash" IS NOT NULL);
```

- [ ] **Step 6: Adaptar el servicio y los DTOs de fútbol**

En `apps/api/src/football/dto.ts`, reemplazar las validaciones de string libre por `@IsEnum` en los campos de estado y tipo:

```typescript
import { IsEnum } from 'class-validator';
import { EstadoPartido, TipoEventoPartido, RolPlantel, GeneroCategoria } from '@prisma/client';
```

```typescript
  @IsOptional()
  @IsEnum(EstadoPartido)
  status?: EstadoPartido;
```

```typescript
  @IsEnum(TipoEventoPartido)
  tipo: TipoEventoPartido;
```

En `apps/api/src/football/football.service.ts`, reemplazar las anotaciones de tipo `string` de esos mismos campos por los tipos de enum importados de `@prisma/client`. El compilador de TypeScript señala cada lugar; no hay que buscarlos a mano.

- [ ] **Step 7: Regenerar, resetear y correr todo**

Desde `apps/api`:

```bash
npm run db:baseline
npx prisma migrate reset --force
npm run db:drift
npm run test:db
npm test
npm run build
```

Esperado: todas PASS y sin deriva.

Si el seed falla porque `torneo-demo.seed.cjs` o `public-accounts.seed.cjs` crean una cuenta pública sin `googleId` ni `passwordHash`, corregir el seed para que siempre provea uno de los dos.

- [ ] **Step 8: Commit**

```bash
git add -A apps/api
git commit -m "feat(db): restricciones de integridad en el dominio de fútbol

Persona.email pasa a único (el login público resuelve cuentas por
email), camiseta única por equipo, Suspension.origenPartidoId pasa de
string suelto a FK real, CHECK de goles no negativos y de cuenta
pública con al menos un método de autenticación. Enums de estado de
partido, tipo de evento, género, rol de plantel y rol de cuenta.
Índices en las columnas de FK que se usan para join."
```

---

### Task 8: Dominio auditoría / configuración y rol de usuario

Es la tanda de mayor riesgo: cambia el RBAC. Va al final para que el resto ya esté verde.

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`Usuario.role`, enum `RolUsuario`)
- Modify: `apps/api/src/common/roles.ts` (eliminar la capa de alias)
- Modify: `apps/api/src/users/users.service.ts:86,106`, `apps/api/src/auth/auth.service.ts:76`
- Modify: `apps/api/src/users/dto.ts` (validación del rol)
- Modify: `apps/api/prisma/seeds/users-demo.seed.cjs`
- Modify: el selector de rol de `apps/web-admin` (pantalla de usuarios)
- Test: `apps/api/test/db/auth-constraints.test.ts`
- Modify: `apps/api/test/unit/` (los tests que usan roles heredados)

**Interfaces:**
- Consumes: los enums y constraints de las tareas 4 a 7.
- Produces: enum `RolUsuario` con los 7 valores canónicos. Desaparecen `LEGACY_ROLE_ALIASES` y `normalizeApiRole` de `src/common/roles.ts`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/test/db/auth-constraints.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

describe('restricciones de auth y auditoría', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('acepta los siete roles canónicos', async () => {
    const roles = [
      'SuperAdmin',
      'Admin',
      'Operador_Stock',
      'Vendedor',
      'Gerente_Ventas',
      'Operador_Futbol',
      'Operador_Cocina',
    ] as const;
    for (const [i, role] of roles.entries()) {
      const u = await prisma.usuario.create({
        data: { username: `u${i}`, name: `U${i}`, role, password: 'x' },
      });
      expect(u.role).toBe(role);
    }
  });

  it('rechaza un rol heredado', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "usuarios" ("id", "username", "name", "role", "password", "updatedAt")
         VALUES (gen_random_uuid()::text, 'legacy', 'Legacy', 'Encargado_Stock', 'x', now())`,
      ),
    ).rejects.toThrow();
  });

  it('al borrar un usuario, su auditoría sobrevive con userId nulo', async () => {
    const usuario = await prisma.usuario.create({
      data: { username: 'auditado', name: 'A', role: 'Vendedor', password: 'x' },
    });
    const entrada = await prisma.entradaAuditoria.create({
      data: {
        userId: usuario.id,
        userName: 'auditado',
        action: 'creo',
        element: 'producto',
      },
    });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    const releida = await prisma.entradaAuditoria.findUnique({ where: { id: entrada.id } });
    expect(releida).not.toBeNull();
    expect(releida?.userId).toBeNull();
    expect(releida?.userName).toBe('auditado');
  });
});
```

El tercer test es el que prueba que la deriva quedó corregida: hoy el schema declara `onDelete: SetNull` pero la base tiene `RESTRICT`, así que el borrado falla.

- [ ] **Step 2: Correr los tests para verificar que fallan**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: FAIL en el rechazo del rol heredado. El de los siete roles puede pasar ya (hoy la columna es texto libre); el de auditoría pasa si la Task 2 ya aplicó la baseline con el `SetNull` correcto — anotar el resultado.

- [ ] **Step 3: Agregar el enum y cambiar la columna**

En el bloque de enums de `apps/api/prisma/schema.prisma`, agregar:

```prisma
enum RolUsuario {
  SuperAdmin
  Admin
  Operador_Stock
  Vendedor
  Gerente_Ventas
  Operador_Futbol
  Operador_Cocina
}
```

En `Usuario` (línea 20):

```prisma
  role      RolUsuario @default(Vendedor)
```

El default cambia de `Operador` (valor deprecado que ya no existe) a `Vendedor`, que es a lo que los alias heredados mapeaban `Operador`.

- [ ] **Step 4: Eliminar la capa de alias de roles**

Reemplazar el contenido completo de `apps/api/src/common/roles.ts`:

```typescript
/** Roles canónicos y grupos de permisos para RBAC en la API. */

import { RolUsuario } from '@prisma/client';

export const ROLES = {
  SUPER_ADMIN: RolUsuario.SuperAdmin,
  ADMIN: RolUsuario.Admin,
  OPERADOR_STOCK: RolUsuario.Operador_Stock,
  VENDEDOR: RolUsuario.Vendedor,
  GERENTE_VENTAS: RolUsuario.Gerente_Ventas,
  OPERADOR_FUTBOL: RolUsuario.Operador_Futbol,
  OPERADOR_COCINA: RolUsuario.Operador_Cocina,
} as const;

export type Role = RolUsuario;

/** Roles que se pueden asignar al crear o editar usuarios. */
export const ASSIGNABLE_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.OPERADOR_STOCK,
  ROLES.VENDEDOR,
  ROLES.GERENTE_VENTAS,
  ROLES.OPERADOR_FUTBOL,
  ROLES.OPERADOR_COCINA,
] as const;

export function isKnownRole(role: string): role is RolUsuario {
  return Object.values(RolUsuario).includes(role as RolUsuario);
}

export function assertAssignableRole(role: string): RolUsuario {
  if (!ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
    throw new Error(`Invalid role: ${role}`);
  }
  return role as RolUsuario;
}

export function hasAnyRole(userRole: string, allowedRoles: readonly string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/** Acceso total de administración del sistema. */
export const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN] as const;

/** Gestión de usuarios y roles. */
export const USER_MANAGEMENT_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN] as const;

/** Lectura de inventario. */
export const STOCK_READ_ROLES = [...ADMIN_ROLES, ROLES.OPERADOR_STOCK] as const;
export const STOCK_MUTATION_ROLES = [...STOCK_READ_ROLES] as const;
export const STOCK_COUNT_ROLES = [...STOCK_MUTATION_ROLES] as const;
export const STOCK_CONSUMPTION_ROLES = [...STOCK_MUTATION_ROLES] as const;

/** Lectura del módulo de ventas físicas. */
export const SALES_READ_ROLES = [
  ...ADMIN_ROLES,
  ROLES.GERENTE_VENTAS,
  ROLES.VENDEDOR,
] as const;
export const SALES_OPERATION_ROLES = [...SALES_READ_ROLES] as const;

/** Configuración del catálogo de ventas. */
export const SALES_CATALOG_ROLES = [...ADMIN_ROLES, ROLES.GERENTE_VENTAS] as const;

/** Anulación y edición de tickets. */
export const SALES_ADMIN_ROLES = [...ADMIN_ROLES, ROLES.GERENTE_VENTAS] as const;

/** Impresión de tickets (mostrador). */
export const PRINTER_ROLES = [
  ...ADMIN_ROLES,
  ROLES.GERENTE_VENTAS,
  ROLES.VENDEDOR,
] as const;

/** Panel de fútbol. */
export const FOOTBALL_READ_ROLES = [...ADMIN_ROLES, ROLES.OPERADOR_FUTBOL] as const;
export const FOOTBALL_MUTATION_ROLES = [...FOOTBALL_READ_ROLES] as const;

/** Panel online y cocina. */
export const ONLINE_READ_ROLES = [...ADMIN_ROLES, ROLES.OPERADOR_COCINA] as const;
export const ONLINE_MUTATION_ROLES = [...ONLINE_READ_ROLES] as const;
export const KITCHEN_READ_ROLES = [...ONLINE_READ_ROLES] as const;
export const KITCHEN_MUTATION_ROLES = [...ONLINE_MUTATION_ROLES] as const;

export const MIN_PASSWORD_LENGTH = 8;

export function isVendedorRole(role: string): boolean {
  return role === ROLES.VENDEDOR;
}
```

- [ ] **Step 5: Corregir los consumidores**

En `apps/api/src/auth/auth.service.ts:76`, el default en texto pasa al enum:

```typescript
  async createUser(username: string, password: string, name: string, role: RolUsuario = ROLES.VENDEDOR) {
```

Agregar los imports que falten:

```typescript
import { RolUsuario } from '@prisma/client';
import { ROLES } from '../common/roles';
```

En `apps/api/src/users/users.service.ts`, cambiar la firma de `assertNotLastSuperAdmin` (línea 106) de `role: string` a `role: RolUsuario`.

En `apps/api/src/users/dto.ts`, reemplazar la validación del campo `role` por:

```typescript
  @IsOptional()
  @IsEnum(RolUsuario)
  role?: RolUsuario;
```

Compilar para que TypeScript señale el resto:

```bash
npm run build
```

Corregir cada error que reporte. Cualquier referencia sobrante a `normalizeApiRole` o a un rol heredado (`Gerente_Operaciones`, `Encargado_Stock`, `Encargado_Futbol`, `Operador`, `Viewer`) aparece acá.

- [ ] **Step 6: Actualizar los seeds y los tests con roles heredados**

```bash
rg -n "Gerente_Operaciones|Encargado_Stock|Encargado_Futbol|'Operador'|'Viewer'|normalizeApiRole" apps/
```

En cada resultado, reemplazar por el rol canónico correspondiente: `Gerente_Operaciones` y `Operador` por `Vendedor` o `Gerente_Ventas` según el permiso que el caso necesite, `Encargado_Stock` por `Operador_Stock`, `Encargado_Futbol` por `Operador_Futbol`, y `Viewer` por `Operador_Stock`.

- [ ] **Step 7: Actualizar el selector de rol del admin**

En la pantalla de usuarios de `apps/web-admin`, la lista de roles ofrecidos debe ser exactamente los seis de `ASSIGNABLE_ROLES`. Ubicarla con:

```bash
rg -n "Gerente_Operaciones|Encargado_Stock|Encargado_Futbol|SuperAdmin" apps/web-admin/src
```

- [ ] **Step 8: Regenerar, resetear y correr todo**

Desde `apps/api`:

```bash
npm run db:baseline
npx prisma migrate reset --force
npm run db:drift
npm run test:db
npm test
npm run build
```

Desde `apps/web-admin`:

```bash
npm run build
```

Esperado: todas PASS y sin deriva.

- [ ] **Step 9: Verificar el login a mano**

Desde `apps/api`, en una terminal:

```bash
npm run dev
```

En otra:

```bash
curl -s -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

Esperado: respuesta con un `access_token` y `role: "SuperAdmin"`. Detener el servidor.

- [ ] **Step 10: Commit**

```bash
git add -A apps
git commit -m "feat(db): rol de usuario como enum y baja de los alias heredados

Usuario.role pasa a RolUsuario con los 7 valores canónicos, con lo que
desaparece la capa de alias de roles.ts que traducía Gerente_Operaciones,
Encargado_Stock, Encargado_Futbol, Operador y Viewer. Verifica además
que el FK de auditoría quedó realmente en SET NULL, que el schema
declaraba pero la base tenía en RESTRICT."
```

---

### Task 9: Separar los seeds y corregir la idempotencia

**Files:**
- Modify: `apps/api/prisma/seed.cjs` (solo datos de referencia)
- Create: `apps/api/prisma/seed-demo.cjs`
- Delete: `apps/api/prisma/seed.ts`
- Modify: `apps/api/prisma/seeds/users-demo.seed.cjs:17-19`
- Modify: `apps/api/prisma/seeds/public-accounts.seed.cjs:18-46`
- Modify: `apps/api/prisma/seeds/online-demo.seed.cjs:93-110`
- Modify: `apps/api/package.json` (script `prisma:seed:demo`)
- Test: `apps/api/test/db/seed-idempotency.test.ts`

**Interfaces:**
- Consumes: todo el esquema corregido de las tareas 4 a 8.
- Produces: `npm run prisma:seed` (referencia, idempotente) y `npm run prisma:seed:demo` (demo, opcional).

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/test/db/seed-idempotency.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { testPrisma, resetTestDb, TEST_DATABASE_URL } from './helpers/db';

const prisma = testPrisma();

function runSeed(script: string) {
  return spawnSync('node', [`prisma/${script}`], {
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

describe('idempotencia de los seeds', () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('el seed de referencia corre dos veces sin errores y sin duplicar', async () => {
    const first = runSeed('seed.cjs');
    expect(first.status, first.stderr).toBe(0);
    const afterFirst = await prisma.categoria.count();

    const second = runSeed('seed.cjs');
    expect(second.status, second.stderr).toBe(0);
    const afterSecond = await prisma.categoria.count();

    expect(afterSecond).toBe(afterFirst);
  });

  it('el seed de referencia no cambia la contraseña de un usuario existente', async () => {
    const before = await prisma.usuario.findUnique({ where: { username: 'admin' } });
    expect(before).not.toBeNull();

    const again = runSeed('seed.cjs');
    expect(again.status, again.stderr).toBe(0);

    const after = await prisma.usuario.findUnique({ where: { username: 'admin' } });
    expect(after?.password).toBe(before?.password);
  });

  it('el seed de demo corre dos veces sin violar el número único de ticket', async () => {
    const first = runSeed('seed-demo.cjs');
    expect(first.status, first.stderr).toBe(0);
    const second = runSeed('seed-demo.cjs');
    expect(second.status, second.stderr).toBe(0);

    const numbers = await prisma.ticketVenta.findMany({ select: { number: true } });
    expect(new Set(numbers.map(n => n.number)).size).toBe(numbers.length);
  });

  it('el seed de demo no cambia contraseñas de cuentas públicas existentes', async () => {
    const before = await prisma.cuentaPublica.findMany({
      select: { email: true, passwordHash: true },
      orderBy: { email: 'asc' },
    });
    const again = runSeed('seed-demo.cjs');
    expect(again.status, again.stderr).toBe(0);
    const after = await prisma.cuentaPublica.findMany({
      select: { email: true, passwordHash: true },
      orderBy: { email: 'asc' },
    });
    expect(after).toEqual(before);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: FAIL. `prisma/seed-demo.cjs` no existe, y los tests de contraseñas fallan porque los seeds actuales las re-hashean en cada corrida.

- [ ] **Step 3: Dejar en seed.cjs solo los datos de referencia**

En `apps/api/prisma/seed.cjs`, borrar los `require` de los seeds de demo (líneas 9-14: `torneo-demo`, `inventory`, `cantina`, `public-accounts`, `online-demo`, `users-demo`) y sus invocaciones (líneas 89-94), dejando solo `seedScheduling` y `seedReglamento`. Agregar el seed de categorías de venta, que es dato de referencia:

```javascript
  await Promise.all([
    prisma.categoriaVenta.upsert({
      where: { name: 'Comidas' },
      update: {},
      create: { name: 'Comidas', emoji: '🍔', sortOrder: 0 },
    }),
    prisma.categoriaVenta.upsert({
      where: { name: 'Bebidas' },
      update: {},
      create: { name: 'Bebidas', emoji: '🥤', sortOrder: 1 },
    }),
  ]);
```

El bloque de usuario admin (líneas 59-73) ya es correcto: no toca la contraseña si el usuario existe. No modificarlo.

- [ ] **Step 4: Crear el seed de demo**

Crear `apps/api/prisma/seed-demo.cjs`:

```javascript
/**
 * Datos de demostración. Opcional: `npm run prisma:seed:demo`.
 * Requiere que el seed de referencia (prisma/seed.cjs) ya haya corrido.
 */
const { PrismaClient } = require('@prisma/client');
const { seedInventory } = require('./seeds/inventory.seed.cjs');
const { seedTorneoDemo } = require('./seeds/torneo-demo.seed.cjs');
const { seedCantinaPublica } = require('./seeds/cantina.seed.cjs');
const { seedPublicAccounts } = require('./seeds/public-accounts.seed.cjs');
const { seedOnlineDemo } = require('./seeds/online-demo.seed.cjs');
const { seedDemoUsers } = require('./seeds/users-demo.seed.cjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  // El orden importa: torneo-demo necesita las categorías de scheduling,
  // cantina necesita los productos de stock, online-demo necesita cantina
  // y las cuentas públicas.
  await seedInventory(prisma);
  await seedTorneoDemo(prisma);
  await seedCantinaPublica(prisma);
  await seedPublicAccounts(prisma);
  await seedOnlineDemo(prisma);
  await seedDemoUsers(prisma);

  console.log('Demo seed complete.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 5: Dejar de sobrescribir contraseñas**

En `apps/api/prisma/seeds/users-demo.seed.cjs`, el bloque de las líneas 17-19 re-hashea en cada corrida. Reemplazar el patrón por uno que hashee solo al crear:

```javascript
    const existing = await prisma.usuario.findUnique({ where: { username: user.username } });
    if (existing) {
      await prisma.usuario.update({
        where: { id: existing.id },
        data: { name: user.name, role: user.role },
      });
      continue;
    }
    await prisma.usuario.create({
      data: {
        username: user.username,
        name: user.name,
        role: user.role,
        password: await bcrypt.hash(user.password, 10),
      },
    });
```

Aplicar el mismo patrón en `apps/api/prisma/seeds/public-accounts.seed.cjs:18-46`: al actualizar una cuenta existente, no incluir `passwordHash` en el `data`.

- [ ] **Step 6: Reservar el número de ticket con el contador**

En `apps/api/prisma/seeds/online-demo.seed.cjs:93-110`, el ticket se crea con `number: ticketNumber + 50` sin incrementar el contador, lo que puede violar el único de `tickets_venta.number`. Reemplazar el cálculo por una reserva real:

```javascript
  const contador = await prisma.contadorTicket.update({
    where: { id: 'default' },
    data: { valor: { increment: 1 } },
  });
  const ticketNumber = contador.valor;
```

Y usar `ticketNumber` directamente en el `create`, sin el `+ 50`.

- [ ] **Step 7: Borrar el seed obsoleto y agregar el script**

```bash
git rm apps/api/prisma/seed.ts
```

En `apps/api/package.json`, agregar dentro de `"scripts"`, después de `"prisma:seed"`:

```json
    "prisma:seed:demo": "node prisma/seed-demo.cjs",
```

- [ ] **Step 8: Correr los tests para verificar que pasan**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: PASS, incluidos los 4 tests de idempotencia.

- [ ] **Step 9: Verificar el flujo completo desde cero**

Desde `apps/api`:

```bash
npx prisma migrate reset --force
npm run prisma:seed:demo
npm run prisma:seed
npm run prisma:seed:demo
```

Esperado: las cuatro corridas terminan con código 0. `migrate reset` invoca automáticamente `prisma:seed` (el de referencia) por la clave `prisma.seed` de `package.json`.

- [ ] **Step 10: Actualizar el runbook**

En `docs/RUNBOOK.md` y en el bloque de "Inicio rápido" de `README.md:35-47`, documentar los dos seeds: `npm run prisma:seed` para datos de referencia y `npm run prisma:seed:demo` para los de demostración.

- [ ] **Step 11: Commit**

```bash
git add -A apps/api docs README.md
git commit -m "refactor(db): separar seeds de referencia y de demo, corregir idempotencia

Los seeds de usuarios demo y cuentas públicas re-hasheaban y
sobrescribían contraseñas en cada corrida, y online-demo creaba un
ticket con número contador+50 sin incrementar el contador, lo que podía
violar el único de tickets_venta.number. Elimina seed.ts, obsoleto: le
faltaban tres de los seeds que sí invoca seed.cjs."
```

---

### Task 10: Comando de reconciliación de datos derivados

**Files:**
- Create: `apps/api/scripts/reconcile-stock.mjs`
- Modify: `apps/api/package.json` (script `db:reconcile`)
- Test: `apps/api/test/db/reconcile.test.ts`

**Interfaces:**
- Consumes: el esquema corregido y los seeds de las tareas 4 a 9.
- Produces: `npm run db:reconcile` — sale con 0 si no hay deriva, con 1 si la hay. Solo reporta; no corrige.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/test/db/reconcile.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { testPrisma, resetTestDb, TEST_DATABASE_URL } from './helpers/db';

const prisma = testPrisma();

function runReconcile() {
  return spawnSync('node', ['scripts/reconcile-stock.mjs'], {
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

describe('reconciliación de datos derivados', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('no reporta deriva en una base vacía', () => {
    const result = runReconcile();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it('no reporta deriva cuando el nivel coincide con los movimientos', async () => {
    const categoria = await prisma.categoria.create({ data: { name: 'Bebidas' } });
    const deposito = await prisma.deposito.create({
      data: { name: 'Principal', location: 'Central' },
    });
    const producto = await prisma.producto.create({
      data: { name: 'Agua', code: 'BEB-001', categoryId: categoria.id },
    });
    await prisma.movimientoStock.create({
      data: { type: 'entrada', productId: producto.id, warehouseId: deposito.id, quantity: 10 },
    });
    await prisma.nivelStock.create({
      data: { productId: producto.id, warehouseId: deposito.id, quantity: 10 },
    });

    const result = runReconcile();
    expect(result.status, result.stdout).toBe(0);
  });

  it('reporta deriva cuando el nivel no coincide con los movimientos', async () => {
    const categoria = await prisma.categoria.create({ data: { name: 'Snacks' } });
    const deposito = await prisma.deposito.create({
      data: { name: 'Kiosco', location: 'Cancha' },
    });
    const producto = await prisma.producto.create({
      data: { name: 'Papas', code: 'SNK-001', categoryId: categoria.id },
    });
    await prisma.movimientoStock.create({
      data: { type: 'entrada', productId: producto.id, warehouseId: deposito.id, quantity: 10 },
    });
    await prisma.nivelStock.create({
      data: { productId: producto.id, warehouseId: deposito.id, quantity: 7 },
    });

    const result = runReconcile();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('SNK-001');
  });

  it('reporta deriva cuando el total del ticket no coincide con sus líneas', async () => {
    const cocina = await prisma.cocina.create({ data: { name: 'Parrilla' } });
    const catVenta = await prisma.categoriaVenta.create({ data: { name: 'Comidas' } });
    const menu = await prisma.productoVenta.create({
      data: {
        name: 'Hamburguesa',
        categoriaVentaId: catVenta.id,
        kitchenId: cocina.id,
        price: 8500,
      },
    });
    const usuario = await prisma.usuario.create({
      data: { username: 'op', name: 'Op', role: 'Vendedor', password: 'x' },
    });
    const ticket = await prisma.ticketVenta.create({
      data: { number: 5000, total: 1, operatorId: usuario.id },
    });
    await prisma.itemTicketVenta.create({
      data: {
        ticketId: ticket.id,
        salesProductId: menu.id,
        name: 'Hamburguesa',
        unitPrice: 8500,
        quantity: 2,
      },
    });

    const result = runReconcile();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('5000');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: FAIL. `scripts/reconcile-stock.mjs` no existe.

- [ ] **Step 3: Escribir el comando de reconciliación**

Crear `apps/api/scripts/reconcile-stock.mjs`. Agrega en SQL, no en memoria, porque el objetivo es que sirva sobre una base con historial largo.

```javascript
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

async function main() {
  const stockDrift = await checkStockLevels();
  const ticketDrift = await checkTicketTotals();
  await prisma.$disconnect();

  const total = stockDrift + ticketDrift;
  if (total === 0) {
    console.log('Sin deriva: niveles de stock y totales de ticket coinciden con su origen.');
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
```

- [ ] **Step 4: Agregar el script a package.json**

En `apps/api/package.json`, agregar dentro de `"scripts"`, después de `"db:baseline"`:

```json
    "db:reconcile": "node scripts/reconcile-stock.mjs",
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Desde `apps/api`:

```bash
npm run test:db
```

Esperado: PASS, incluidos los 4 tests de reconciliación.

- [ ] **Step 6: Correr la reconciliación sobre la base de desarrollo**

Desde `apps/api`:

```bash
npx prisma migrate reset --force
npm run prisma:seed:demo
npm run db:reconcile
```

Esperado: `Sin deriva: niveles de stock y totales de ticket coinciden con su origen.`

Si reporta deriva, es un hallazgo real de los seeds de demo: significa que crean niveles de stock sin el movimiento correspondiente. Corregir el seed para que cada nivel tenga su movimiento de `entrada`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/scripts/reconcile-stock.mjs apps/api/package.json apps/api/test/db/reconcile.test.ts
git commit -m "feat(db): comando de reconciliación de datos derivados

Compara niveles_stock contra la suma del libro mayor de movimientos, y
el total de cada ticket contra la suma de sus líneas. Solo reporta:
corregir automáticamente esconderría el bug del backend que produjo la
deriva, que es lo que arregla el proyecto B."
```

---

### Task 11: Cierre y verificación completa

**Files:**
- Modify: `docs/ARCHITECTURE.md` (dos migraciones, enums, política de borrado)
- Modify: `docs/RUNBOOK.md` (comandos nuevos)
- Modify: `apps/api/prisma/schema.prisma` (solo el comentario de cabecera, si hace falta)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada nuevo. Es la verificación de los criterios de aceptación del spec.

- [ ] **Step 1: Verificar que hay exactamente dos migraciones**

Desde `apps/api`:

```bash
ls prisma/migrations
```

Esperado: `20260906120000_baseline` y `20260906120100_constraints`, nada más.

- [ ] **Step 2: Verificar que la baseline no tiene SQL destructivo ni escrito a mano**

Desde `apps/api`:

```bash
rg -n "^(DELETE|DROP|UPDATE)" prisma/migrations/20260906120000_baseline/migration.sql
rg -n "^(DELETE|DROP|UPDATE)" prisma/migrations/20260906120100_constraints/migration.sql
```

Esperado: sin salida en ninguno de los dos.

- [ ] **Step 3: Verificar que no queda ninguna referencia al código eliminado**

Desde la raíz del repo:

```bash
rg -n "ProductoOnline|productoOnline|online-catalog|onlineCatalog|LogConsumo|logConsumo|EntradaConsumo|entradaConsumo|findAllTables|normalizeApiRole|LEGACY_ROLE_ALIASES" apps/ docs/
```

Esperado: sin salida.

- [ ] **Step 4: Correr la verificación completa desde cero**

Desde `apps/api`:

```bash
npx prisma migrate reset --force
npm run db:drift
npm run db:reconcile
npm run test:db
npm run build
```

Desde la raíz del repo:

```bash
npm test
```

Desde `apps/web-admin`:

```bash
npm run build
```

Desde `apps/web-public`:

```bash
npm run build
```

Esperado: todas PASS, sin deriva y sin inconsistencias.

- [ ] **Step 5: Actualizar la documentación de arquitectura**

En `docs/ARCHITECTURE.md`, agregar una sección sobre la base de datos que registre: que `schema.prisma` es la única fuente de verdad; que el estado de la base son dos migraciones, una generada con `node scripts/generate-baseline.mjs` (nunca editada a mano) y otra solo con `CHECK` constraints; la política de borrado (`Restrict` para catálogo con historial, `Cascade` para detalle dentro de un padre, `SetNull` para referencias opcionales); y que los enums viven en el bloque de cabecera del schema.

En `docs/RUNBOOK.md`, documentar los comandos nuevos:

| Comando | Qué hace |
|---|---|
| `npm run db:baseline` | Regenera la migración baseline desde `schema.prisma` |
| `npm run db:drift` | Falla si el schema y las migraciones no coinciden |
| `npm run db:reconcile` | Reporta deriva entre datos derivados y su origen |
| `npm run test:db` | Tests de restricciones contra PostgreSQL real |
| `npm run prisma:seed` | Datos de referencia (idempotente) |
| `npm run prisma:seed:demo` | Datos de demostración (opcional) |

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs: registrar el modelo de migraciones y los comandos de base de datos"
```

- [ ] **Step 7: Revisar el diff completo de la rama**

Desde la raíz del repo. La base es el merge-base contra `feature/clientes-web-publica-cocina-futbol`, **no** `main`: usar `main` incluiría todo el trabajo previo de la rama de features y produciría un diff inmanejable.

```bash
$base = git merge-base feature/clientes-web-publica-cocina-futbol HEAD
git log --oneline "$base..HEAD"
git diff "$base...HEAD" --stat
```

Esperado: un commit por cada una de las tareas 1 a 11 (los de la Task 0 quedan por debajo del merge-base), y un diff acotado a `apps/api/prisma`, `apps/api/src`, `apps/api/scripts`, `apps/api/test`, los mappers y pantallas del admin listados en el plan, los clientes de los dos frontends, y `docs/`.

---

## Self-Review

**Cobertura del spec.** Cada sección del spec tiene su tarea: D1 en la Task 2; D2 repartida entre las tareas 4 (consumo heredado) y 6 (catálogo online); D3 en la Task 5; D4 en las tareas 4 a 8, un dominio por tanda; D5 en las constraints de las tareas 4 a 7 y el comando de la Task 10; D6 en las relaciones explícitas de las tareas 4 a 7; D7 en la Task 9; D8 en la Task 1 más los tests de cada tanda; D9 en la estructura misma de las tareas 4 a 8; D10 en la Task 3. Los ocho criterios de aceptación se verifican en la Task 11.

**Riesgos que el plan deja explícitos, no escondidos.**

1. **La `CHECK` constraint frente al chequeo de deriva.** `prisma migrate diff` no modela `CHECK`, así que podría reportarlas como diferencia pendiente. El Step 9 de la Task 4 verifica esto en el primer punto donde puede ocurrir, y trae el plan de contingencia del spec.
2. **`Persona.email` único.** Si algún seed crea dos personas con el mismo email, el reset falla. El Step 7 de la Task 7 lo anticipa.
3. **El enum de rol rompe el RBAC.** Es el cambio de mayor alcance, por eso va último y tiene una verificación manual de login (Step 9 de la Task 8).
4. **`ProductoVenta.categoriaVentaId` es NOT NULL.** Todo producto de menú necesita una categoría existente, así que el seed de cantina tiene que crear `CategoriaVenta` antes de los productos: es el Step 7 de la Task 5, y por eso el seed de referencia también las crea (Step 3 de la Task 9).

**Consistencia de nombres.** `testPrisma`, `resetTestDb` y `TEST_DATABASE_URL` se declaran en la Task 1 y se usan con esos mismos nombres en las tareas 4 a 10. `node scripts/generate-baseline.mjs` (script `db:baseline`) se declara en la Task 2 y se invoca en las tareas 4 a 8. `isPrismaUniqueConflict`, `isPrismaForeignKeyViolation` e `isPrismaRecordNotFound` se declaran en la Task 3 y solo la primera se consume después. `categoriaVentaId` es el nombre en las tareas 5, 9 y 10.
