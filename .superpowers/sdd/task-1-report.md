# Task 1 Report — Infraestructura de tests contra PostgreSQL real

## What Was Implemented

- **`apps/api/test/db/smoke.test.ts`** — Smoke test with two assertions: DB connectivity (`SELECT 1`) and empty migrated schema (`producto.count()` / `usuario.count()` both 0).
- **`apps/api/test/db/helpers/db.ts`** — Exports `testPrisma()`, `resetTestDb()`, and `TEST_DATABASE_URL` pointing at `lch_stock_test`.
- **`apps/api/vitest.db.config.ts`** — Separate Vitest config for DB tests (`fileParallelism: false`, 30s/60s timeouts).
- **`apps/api/scripts/reset-test-db.mjs`** — Runs `prisma migrate reset --force --skip-seed --skip-generate` against the test database URL.
- **`apps/api/scripts/drift-check.mjs`** — Runs `prisma migrate diff --exit-code` comparing migrations to `schema.prisma` via shadow DB.
- **`apps/api/package.json`** — Added `test:db` and `db:drift` scripts.

## What Was Tested

| Command | Result |
|---------|--------|
| `npm run test:db` | **PASS** — 2/2 tests, output pristine |
| `npm test` | **PASS** — 186/186 tests (includes smoke.test.ts; see concerns) |
| `npm run db:drift` | **Works as designed** — exits 1 with drift message (expected before task 2 baseline squash) |

## TDD Evidence

### RED

**Command:**
```bash
cd apps/api
npx vitest run --config vitest.db.config.ts
```

**Output (before implementation):**
```
X [ERROR] Could not resolve ".../vitest.db.config.ts"

failed to load config from .../vitest.db.config.ts

⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯⎯
Error: Build failed with 1 error:
error: Could not resolve ".../vitest.db.config.ts"
```

**Why expected:** Neither `vitest.db.config.ts` nor `./helpers/db` existed yet. Vitest fails at config resolution before reaching the test file's import error.

### GREEN

**Command:**
```bash
cd apps/api
npm run test:db
```

**Output (after implementation):**
```
Reseteando base de test: postgresql://lch:****@localhost:5432/lch_stock_test?schema=public
...
PostgreSQL database lch_stock_test created at localhost:5432
...
Database reset successful
...
 ✓ test/db/smoke.test.ts (2 tests) 790ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

## Files Changed

| File | Action |
|------|--------|
| `apps/api/vitest.db.config.ts` | Created |
| `apps/api/scripts/reset-test-db.mjs` | Created |
| `apps/api/scripts/drift-check.mjs` | Created |
| `apps/api/test/db/helpers/db.ts` | Created |
| `apps/api/test/db/smoke.test.ts` | Created |
| `apps/api/package.json` | Modified (added `test:db`, `db:drift`) |

## Self-Review

- **Completeness:** All five files and package.json scripts from the brief are present.
- **Quality:** Code matches brief verbatim except one necessary deviation (see concerns).
- **Discipline:** No schema changes, no modifications to existing mock-based tests or `vitest.config.ts`.
- **Testing:** Smoke tests hit real PostgreSQL; TDD RED/GREEN cycle followed.

## Issues and Concerns

### 1. `DIRECT_URL` override in `reset-test-db.mjs` (deviation from brief)

The brief's script only sets `DATABASE_URL` in the child env. This project's `schema.prisma` also declares `directUrl = env("DIRECT_URL")`. Without overriding `DIRECT_URL`, Prisma's `migrate reset` targets `lch_stock` (from `.env`) even when `DATABASE_URL` points to `lch_stock_test`. **Fix applied:** added `DIRECT_URL: url` alongside `DATABASE_URL: url` in the spawn env. Recommend updating the brief for future runs.

### 2. `npm test` picks up DB smoke tests

`vitest.config.ts` uses `include: ['test/**/*.test.ts']`, which matches `test/db/smoke.test.ts`. The brief forbids modifying `vitest.config.ts` in this task, so `npm test` now runs the DB smoke test (186 total, +2). It passed here because Docker/Postgres was running, but would fail in environments without a database. A follow-up should add `exclude: ['test/db/**']` to `vitest.config.ts`.

### 3. Shadow database must exist for `db:drift`

`prisma migrate diff --shadow-database-url` requires `lch_stock_shadow` to pre-exist (unlike `migrate reset` which auto-creates the target DB). Created manually via `docker exec ... CREATE DATABASE lch_stock_shadow` for verification. Consider documenting or auto-creating in a future task.

### 4. `db:drift` reports expected drift

With the current 7 incremental migrations vs. the optimized Spanish schema, `db:drift` exits 1 with rename/index drift details. This is correct behavior — task 2 will squash migrations into a baseline that eliminates this drift.

## Commit

```
2d1acf6 test(api): agregar suite de tests contra PostgreSQL real y chequeo de deriva
```

## Fix wave 1

### Finding 1 — `npm test` requería PostgreSQL

**Cambio:** En `apps/api/vitest.config.ts` se importó `configDefaults` de `vitest/config` y se añadió `exclude: [...configDefaults.exclude, 'test/db/**']` para preservar los excludes por defecto de Vitest y aislar la suite `test/db/`.

**Verificación:** `npm test` (desde `apps/api`)

```
 Test Files  20 passed (20)
      Tests  184 passed (184)
```

`test/db/smoke.test.ts` ya no aparece en la salida (antes 186 tests / 21 files).

### Finding 2 — `db:drift` requería crear `lch_stock_shadow` a mano

**Cambio:** En `apps/api/scripts/drift-check.mjs` se añadió `ensureShadowDatabase()`: deriva una URL de mantenimiento apuntando a la base `postgres`, conecta vía `PrismaClient` con override de `datasources`, ejecuta `CREATE DATABASE "lch_stock_shadow"` con `$executeRawUnsafe`, y trata el código PostgreSQL `42P04` (already exists) como éxito.

**Verificación 1 — auto-create tras DROP:** Se eliminó `lch_stock_shadow` con la misma técnica de conexión de mantenimiento, luego `npm run db:drift`:

```
DERIVA DETECTADA: schema.prisma y prisma/migrations no coinciden. Regenerá la baseline con: node scripts/generate-baseline.mjs
EXIT_CODE=1
```

(Salida incluye el diff de tablas renombradas; sin error de conexión.)

**Verificación 2 — idempotencia:** Segunda ejecución de `npm run db:drift` con la base ya existente:

```
DERIVA DETECTADA: schema.prisma y prisma/migrations no coinciden. Regenerá la baseline con: node scripts/generate-baseline.mjs
EXIT_CODE=1
```

Mismo resultado de deriva; el paso de creación no falla cuando la base ya existe.

### Verificaciones adicionales de la wave

| Comando | Resultado |
|---------|-----------|
| `npm test` | PASS — 184/184 (sin `test/db/**`) |
| `npm run test:db` | PASS — 2/2 (`test/db/smoke.test.ts`) |

