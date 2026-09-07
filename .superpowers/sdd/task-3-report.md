# Task 3 report — Traducción de errores Prisma a HTTP

## What you implemented

- Extended `apps/api/src/common/prisma-errors.ts` with `prismaCode` plus `isPrismaForeignKeyViolation` (P2003) and `isPrismaRecordNotFound` (P2025). Existing `isPrismaUniqueConflict` now uses the same helper (same name and signature).
- Added `PrismaExceptionFilter` in `apps/api/src/common/prisma-exception.filter.ts`: maps P2002→409, P2003→400, P2025→404, unmapped known Prisma codes→500. Status mapping stays in the filter, not in `prisma-errors.ts`.
- Registered the filter globally in `apps/api/src/main.ts` immediately after `useGlobalPipes`.
- Removed the local P2002 helper from `sales.service.ts` and imported the shared one. The three call sites still call `isPrismaUniqueConflict`.
- Narrowed the two bare `catch` blocks in `football.service.ts` so only P2002 becomes a domain `ConflictException`. Other errors rethrow (and can reach the global filter). Original messages kept:
  - inscription: `El equipo ya está inscripto en este torneo`
  - captain: `Email o DNI ya registrado en este torneo`
- Left `stock.service.ts` untouched.

## What you tested and the test results

From `apps/api`:

- `npx vitest run test/unit/prisma-errors.test.ts` — 4 passed
- `npx vitest run test/unit/prisma-exception.filter.test.ts` — 6 passed
- `npm run build` — exit 0
- `npm test` — **194/194 passed** (was 184; +4 helpers + 6 filter tests)

`npm test` does not need a database. Pre-existing `npm warn Unknown env config "devdir"` still appears; tests themselves produced no extra warnings.

## TDD Evidence

### RED — helpers

Command: `npx vitest run test/unit/prisma-errors.test.ts` (before implementing the extra helpers)

Result: 1 passed, 3 failed. Expected: `isPrismaUniqueConflict` already existed; `isPrismaForeignKeyViolation` and `isPrismaRecordNotFound` did not.

```
TypeError: (0 , isPrismaForeignKeyViolation) is not a function
TypeError: (0 , isPrismaRecordNotFound) is not a function
Tests  3 failed | 1 passed (4)
```

### GREEN — helpers

Command: `npx vitest run test/unit/prisma-errors.test.ts`

```
✓ test/unit/prisma-errors.test.ts (4 tests)
Tests  4 passed (4)
```

### RED — filter

Command: `npx vitest run test/unit/prisma-exception.filter.test.ts` (before creating the filter file)

Expected: module missing.

```
Error: Cannot find module '../../src/common/prisma-exception.filter'
Test Files  1 failed (1)
Tests  no tests
```

### GREEN — filter

Command: `npx vitest run test/unit/prisma-exception.filter.test.ts test/unit/prisma-errors.test.ts`

```
✓ test/unit/prisma-errors.test.ts (4 tests)
✓ test/unit/prisma-exception.filter.test.ts (6 tests)
Tests  10 passed (10)
```

## How you proved the filter actually fires

1. **Runtime class:** `node -e` requiring `@prisma/client` showed `Prisma.PrismaClientKnownRequestError` is a **function**. `new Prisma.PrismaClientKnownRequestError('msg', { code: 'P2002', clientVersion: '5.22.0' })` is `instanceof Prisma.PrismaClientKnownRequestError` with `code === 'P2002'`. `@Catch(Prisma.PrismaClientKnownRequestError)` therefore receives a real constructor, not `undefined`.
2. **Decorator wiring:** unit test reads `FILTER_CATCH_EXCEPTIONS` metadata on `PrismaExceptionFilter` and asserts it equals `[Prisma.PrismaClientKnownRequestError]`. If the import were wrong, Nest would not register this type and the filter would never be selected.
3. **Mapping:** the same tests construct a real `Prisma.PrismaClientKnownRequestError` for P2002, P2003, P2025, and unmapped `P2010`, call `catch()` with a mocked Express `ArgumentsHost`, and assert HTTP status and JSON body (409 / 400 / 404 / 500 fallback without `prismaCode`).

This does not spin a full Nest HTTP server. It does prove the class exists at runtime, that `@Catch` binds that class, and that `catch()` writes the intended responses.

## Files changed

Committed:

- `apps/api/src/common/prisma-errors.ts` (modified)
- `apps/api/src/common/prisma-exception.filter.ts` (created)
- `apps/api/src/main.ts` (modified)
- `apps/api/src/sales/sales.service.ts` (modified)
- `apps/api/src/football/football.service.ts` (modified)
- `apps/api/test/unit/prisma-errors.test.ts` (created)
- `apps/api/test/unit/prisma-exception.filter.test.ts` (created; extra vs brief)

Not committed (unrelated, already dirty when I finished): `docs/superpowers/plans/2026-09-06-integridad-esquema-bd.md`

Not touched: `stock.service.ts`, migrations, test DB scripts.

## Self-review findings

- Completeness: brief steps 1–10 plus the requested filter test. Football `create` data objects left inline; only the `catch` bodies changed.
- Quality: sales still uses the same helper name at the same three sites. Football no longer reports connection/other failures as uniqueness conflicts; those now propagate (intended). Domain `HttpException`s thrown before the filter still win.
- Discipline: no extra mapping in `prisma-errors.ts`; no refactor of large services.
- Testing: helpers use plain objects (same shape Prisma errors expose via `code`). Filter tests use a **real** Prisma error instance; `ArgumentsHost` is mocked because Nest has no HTTP context in a unit test. Logger methods are stubbed so mapped tests stay quiet.
- First commit message was UTF-16/console-garbled (`c?digos`); amended immediately to the brief’s UTF-8 text. Commit is still local (`feat/integridad-esquema-bd`, not pushed). Wrapper appended `Co-authored-by: Cursor <cursoragent@cursor.com>`.

## Issues or concerns

- Working tree is **not** fully clean: `docs/superpowers/plans/2026-09-06-integridad-esquema-bd.md` is modified and was **not** part of this task. I did not edit it. Left unstaged so Task 3’s commit stays scoped.
- Filter coverage is unit-level (`catch()` + decorator metadata), not an e2e request through Nest’s exception layer. Sufficient to prove the decorator type is the real Prisma class; an HTTP e2e would still be stronger if a later task adds one.
