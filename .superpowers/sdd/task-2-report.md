# Task 2 report — Aplastar las 7 migraciones en una baseline generada

## What was implemented

- Created `apps/api/scripts/generate-baseline.mjs`: runs `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, captures stdout, aborts if there is no `CREATE TABLE`, then writes `prisma/migrations/20260906120000_baseline/migration.sql` with explicit `utf8` (no shell redirection).
- Added `db:baseline` in `apps/api/package.json` immediately after `db:drift`.
- Removed the seven incremental migration directories with `git rm -r`.
- Generated the baseline from the current `schema.prisma` (no schema edits, no hand-edits of the SQL).
- Recreated `lch_stock` with `prisma migrate reset --force` (applies the baseline and runs the seed).
- Verified drift, `test:db`, and `npm test`.
- Captured exact per-table row counts on `lch_stock` before deleting the old migrations and again after reset+seed.

`prisma/schema.prisma` was not modified.

## Verification commands

### Step 4 — generate baseline

```
cd apps/api
npm run db:baseline
```

Output:

```
Baseline regenerada: prisma\migrations\20260906120000_baseline\migration.sql (55435 bytes)
```

Size is tens of thousands of bytes as expected. Node also printed `DEP0190` about `spawnSync` + `shell: true`; that matches the brief’s generator and was left as specified.

### Step 5 — no destructive SQL

```
rg -n "^(DELETE|DROP|UPDATE|ALTER TABLE .* RENAME)" prisma/migrations/20260906120000_baseline/migration.sql
```

Result: no matches. The file is create-only (`CREATE TABLE`, indexes, unique constraints, `ALTER TABLE ... ADD CONSTRAINT` foreign keys).

### Step 6 — reset development database

```
npx prisma migrate reset --force
```

Relevant output:

```
Applying migration `20260906120000_baseline`
Database reset successful
migrations/
  └─ 20260906120000_baseline/
    └─ migration.sql
```

Seed ran successfully (`Seed complete.`). Prisma `generate` printed an `EPERM` rename on `query_engine-windows.dll.node` (file lock on Windows); the command still exited 0 and the seed executed against the new schema. Subsequent tests used the existing client successfully.

### Step 7 — drift

```
npm run db:drift
```

```
No difference detected.
Sin deriva: schema.prisma y prisma/migrations coinciden.
```

Exit 0. The CHECK-constraint contingency did not trigger. `prisma/migrations/` contains only `20260906120000_baseline` plus `migration_lock.toml`.

### Step 8 — test suites

```
npm run test:db
```

Applied `20260906120000_baseline` on `lch_stock_test`. `test/db/smoke.test.ts`: **2 passed**.

```
npm test
```

**20 files, 184 tests, all passed.**

## Row-count comparison

Exact `COUNT(*)` on every `public` table of `lch_stock`.

**Important caveat:** the pre-squash database was **not** a fully seeded development copy. Before the squash it had 7 applied migrations and only three application tables with rows: `contadores_ticket` (1), `contadores_pedido` (1), `filtros_web` (3). Every other application table was 0. Those three non-zero tables are exactly the ones the old migrations inserted. After reset+seed, counts rose because the seed ran on a clean schema.

| table | before | after | Δ | judgment |
|---|---:|---:|---:|---|
| `_prisma_migrations` | 7 | 1 | −6 | Expected: one baseline instead of seven incremental migrations. |
| `filtros_web` | 3 | 4 | +1 | Not a loss. Migration `20260901120000_online_menu_web_sponsors` inserted 3 rows (`popular`, `economico`, `bebidas`). Seed upserts those plus `sin_tacc`. |
| `contadores_ticket` | 1 | 1 | 0 | Preserved. Old insert was `20260820120000_optimize_spanish_schema`; seed also upserts `id=default`. |
| `contadores_pedido` | 1 | 1 | 0 | Same as ticket counter. |
| `campeonatos` | 0 | 1 | +1 | Seed (torneo demo). |
| `canchas` | 0 | 11 | +11 | Seed. |
| `capitanes_autorizados` | 0 | 1 | +1 | Seed. |
| `categorias` | 0 | 5 | +5 | Seed (inventory). |
| `categorias_config` | 0 | 8 | +8 | Seed (torneos bootstrap). |
| `categorias_venta` | 0 | 0 | 0 | Unchanged empty. |
| `categorias_web` | 0 | 2 | +2 | Seed (cantina). |
| `cocinas` | 0 | 4 | +4 | Seed. |
| `configuraciones` | 0 | 0 | 0 | Unchanged empty. |
| `consumos_empleado` | 0 | 0 | 0 | Unchanged empty. |
| `cuentas_equipo` | 0 | 0 | 0 | Unchanged empty. |
| `cuentas_publicas` | 0 | 2 | +2 | Seed. |
| `depositos` | 0 | 4 | +4 | Seed. |
| `entradas_auditoria` | 0 | 0 | 0 | Unchanged empty. |
| `entradas_consumo` | 0 | 0 | 0 | Unchanged empty. |
| `entradas_conteo` | 0 | 0 | 0 | Unchanged empty. |
| `equipos_futbol` | 0 | 6 | +6 | Seed. |
| `equipos_inscripcion` | 0 | 6 | +6 | Seed. |
| `eventos_partido` | 0 | 3 | +3 | Seed. |
| `franjas_horarias` | 0 | 13 | +13 | Seed. |
| `grupos_canchas` | 0 | 3 | +3 | Seed. |
| `impresoras` | 0 | 0 | 0 | Unchanged empty. |
| `inscripciones_jugador` | 0 | 8 | +8 | Seed. |
| `items_combo_venta` | 0 | 0 | 0 | Unchanged empty. |
| `items_orden_cocina` | 0 | 2 | +2 | Seed (online demo). |
| `items_orden_compra` | 0 | 0 | 0 | Unchanged empty. |
| `items_pedido_publico` | 0 | 3 | +3 | Seed. |
| `items_receta` | 0 | 10 | +10 | Seed. |
| `items_ticket_venta` | 0 | 2 | +2 | Seed. |
| `jornadas` | 0 | 1 | +1 | Seed. |
| `logs_consumo` | 0 | 0 | 0 | Unchanged empty. |
| `medios` | 0 | 3 | +3 | Seed. |
| `mesas_venta` | 0 | 0 | 0 | Unchanged empty. |
| `movimientos_stock` | 0 | 1 | +1 | Seed. |
| `niveles_stock` | 0 | 31 | +31 | Seed. |
| `ordenes_cocina` | 0 | 1 | +1 | Seed. |
| `ordenes_compra` | 0 | 0 | 0 | Unchanged empty. |
| `partidos_futbol` | 0 | 2 | +2 | Seed. |
| `patrocinadores` | 0 | 4 | +4 | Seed. |
| `pedidos_publicos` | 0 | 2 | +2 | Seed. |
| `personas` | 0 | 9 | +9 | Seed. |
| `preferencias_horario` | 0 | 0 | 0 | Unchanged empty. |
| `productos` | 0 | 15 | +15 | Seed. |
| `productos_online` | 0 | 1 | +1 | Seed. |
| `productos_venta` | 0 | 7 | +7 | Seed. |
| `productos_venta_filtros` | 0 | 6 | +6 | Seed. |
| `proveedores` | 0 | 3 | +3 | Seed. |
| `proveedores_productos` | 0 | 9 | +9 | Seed. |
| `reglamento_anexos` | 0 | 5 | +5 | Seed. |
| `reglamento_apartados` | 0 | 8 | +8 | Seed. |
| `reglamento_articulos` | 0 | 56 | +56 | Seed. |
| `reglamento_reglas` | 0 | 5 | +5 | Seed. |
| `sesiones_conteo` | 0 | 0 | 0 | Unchanged empty. |
| `suspensiones` | 0 | 1 | +1 | Seed. |
| `temporadas` | 0 | 1 | +1 | Seed. |
| `tickets_venta` | 0 | 1 | +1 | Seed. |
| `tokens_retiro_qr` | 0 | 2 | +2 | Seed. |
| `torneos` | 0 | 8 | +8 | Seed. |
| `torneos_config` | 0 | 1 | +1 | Seed. |
| `usuarios` | 0 | 7 | +7 | Seed. |

**No application table lost rows.** The only decrease is `_prisma_migrations` (7 → 1), which is the squash.

Migration-inserted reference data vs seed:

- `filtros_web`: old SQL in `20260901120000_online_menu_web_sponsors` (3 hardcoded UUID rows). Covered by `cantina.seed.cjs` / `online-demo.seed.cjs` upserts (count 3 → 4).
- `contadores_ticket` / `contadores_pedido`: old SQL in `20260820120000_optimize_spanish_schema`. Covered by `prisma/seed.cjs` upserts (count stays 1).

Because the pre-squash DB had no seed/demo rows, this comparison cannot detect “seed used to create N demo tickets and now creates M”. It **can** detect loss of migration-only reference rows; none occurred.

Throwaway artifacts (gitignored, not committed): `.superpowers/sdd/capture-row-counts.mjs`, `row-counts-before.json`, `row-counts-after.json`.

## Files changed

Created:

- `apps/api/scripts/generate-baseline.mjs`
- `apps/api/prisma/migrations/20260906120000_baseline/migration.sql` (generated, 55435 bytes)

Modified:

- `apps/api/package.json` (`db:baseline` script)

Deleted:

- `apps/api/prisma/migrations/20250618130000_init/`
- `apps/api/prisma/migrations/20260820120000_optimize_spanish_schema/`
- `apps/api/prisma/migrations/20260831104500_public_platform_phase_a1/`
- `apps/api/prisma/migrations/20260901120000_online_menu_web_sponsors/`
- `apps/api/prisma/migrations/20260902120000_public_auth_db_optimize/`
- `apps/api/prisma/migrations/20260904120000_ticket_stock_allocations/`
- `apps/api/prisma/migrations/20260904180000_admin_settings/`

Unrelated working-tree change left unstaged: `docs/superpowers/plans/2026-09-06-integridad-esquema-bd.md` (DIRECT_URL note from task 1; not part of this commit).

## Self-review

- Completeness: brief steps 1–9 plus extra row-count verification are done.
- Quality: generator refuses empty/non-CREATE output; writes UTF-8; does not use `>`.
- Discipline: no `schema.prisma` edits; baseline SQL not hand-edited; no extra tooling under `apps/api/scripts/` beyond the generator; no CHECK-constraint migration invented.
- Testing: each verification command was run and its output read. `db:drift` is 0 by construction of `--from-empty` vs the same schema.

## Issues / concerns

1. Pre-squash `lch_stock` was effectively unseeded. Row-count proof is strong for migration-inserted reference tables, weak for “demo volume stayed the same.” After squash, seed populated the DB as designed.
2. `prisma migrate reset --force` logged `EPERM` renaming the Windows query engine DLL during generate. Reset and seed still succeeded; `test:db` and `npm test` passed. Likely a locked file, not a schema problem.
3. `generate-baseline.mjs` uses `shell: true` as in the brief, which triggers Node `DEP0190`. Harmless here (fixed argument list).
