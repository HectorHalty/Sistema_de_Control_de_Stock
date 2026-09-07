# Progreso — Integridad del esquema de BD

Plan: `docs/superpowers/plans/2026-09-06-integridad-esquema-bd.md`
Spec: `docs/superpowers/specs/2026-09-06-integridad-esquema-bd-design.md`
Rama: `feat/integridad-esquema-bd`
Rama base: `feature/clientes-web-publica-cocina-futbol`
MERGE_BASE: `8743ed7`

## Decisiones de pre-vuelo

- La contingencia sobre las `CHECK` constraints gobierna sobre "exactamente dos migraciones":
  si `db:drift` las reporta como deriva, pasan a `scripts/apply-constraints.mjs` (`db:constraints`)
  encadenado detrás de cada reset, y `prisma/migrations/` queda con una sola carpeta.
- Los diffs de review usan `git merge-base feature/clientes-web-publica-cocina-futbol HEAD`, no `main`.

## Tareas

- Task 0: complete (commits faa816a..8743ed7, sin código — solo git; ejecutada por el controlador)
- Task 1: complete (commits 8743ed7..20ceaae, review clean)
  - Hallazgo importante: `reset-test-db.mjs` tiene que sobreescribir `DIRECT_URL` además de
    `DATABASE_URL`. `schema.prisma:11` declara `directUrl`, así que sin eso el reset de la
    base de test apuntaba a `lch_stock` y borraba la base de desarrollo. Plan ya corregido.
  - `vitest.config.ts` excluye `test/db/**` con `[...configDefaults.exclude, 'test/db/**']`.
  - `drift-check.mjs` autocrea `lch_stock_shadow` (trata 42P04 como éxito).
  - ⚠️ resuelto por el controlador: `npm test` pasa 184/184 con el contenedor de postgres
    detenido, así que la suite por defecto no depende de la base.
- Task 2: complete (commits 20ceaae..cd23f97, review clean)
  - `db:drift` sale 0. Baseline: 63 tablas, 73 FKs, 106 índices, 49 únicos, 0 enums.
  - `prisma/migrations/` queda con `20260906120000_baseline` + `migration_lock.toml`.
  - ⚠️ resuelto por el controlador: los únicos `INSERT` de las 7 migraciones borradas eran
    `contadores_ticket`, `contadores_pedido` (cubiertos por `seed.cjs:75-85`) y `filtros_web`
    (cubierto por `cantina.seed.cjs`). Nada más insertaba datos.
  - **Consecuencia para la Task 9, ya incorporada al plan:** `filtros_web` y `categorias_web`
    los siembra `cantina.seed.cjs`, que la Task 9 convierte en seed de demo. Como la baseline
    ya no los inserta, quedarían solo en demo. El plan ahora extrae la taxonomía web a
    `seeds/web-taxonomy.seed.cjs`, invocada desde el seed de referencia (Task 9, Step 3b).
- Task 3: pendiente
- Task 4: pendiente
- Task 5: pendiente
- Task 6: pendiente
- Task 7: pendiente
- Task 8: pendiente
- Task 9: pendiente
- Task 10: pendiente
- Task 11: pendiente

## Hallazgos Minor acumulados (para triaje en el review final)

- Task 1 — `apps/api/scripts/drift-check.mjs:82-102`: la creación de la base shadow solo está
  cubierta por una verificación manual (drop + dos corridas), no por un test automatizado.
- Task 2 — `apps/api/scripts/generate-baseline.mjs:33-35`: el reemplazo de la baseline no es
  atómico. Si la escritura falla, queda borrada o a medias. Escribir a temporal y renombrar.
- Task 2 — `apps/api/scripts/generate-baseline.mjs:19`: `shell: true` con argumentos dispara el
  warning `DEP0190` de Node. La salida de los comandos de baseline no queda impecable.
- Task 2 — no hay test que ejercite los caminos de fallo de `generate-baseline.mjs` (comando
  fallido, salida sin `CREATE TABLE`), que son justamente su razón de existir.
