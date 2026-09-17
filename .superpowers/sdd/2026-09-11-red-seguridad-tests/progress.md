# SDD ledger — plan: docs/superpowers/plans/2026-09-11-red-seguridad-tests.md

Spec: `docs/superpowers/specs/2026-09-11-red-seguridad-tests-design.md`
Rama: `claude/subagent-dev-task-4-3fe6e4` (fast-forwardeada a `origin/feat/red-seguridad-tests` @ e0f2bfe)
Base: `main` @ 5638194

## Estado heredado (tasks 1–3 ya hechas fuera de esta sesión, 2026-09-16)

- Task 1: complete (commit `283da1b` — "test: coverage Vitest con umbral medido en api, admin y pública.")
- Task 2: complete (commit `b6f1c59` — "test: ticket POS y payload de checkout público como funciones puras.")
- Task 3: complete (commit `e0f2bfe` — "feat: anclas data-testid y confirm de upload a MinIO.")

Confirmado por mensaje de commit exacto contra el plan y por lectura de
`e2e/fixtures/ids.ts` (existe con las keys que Task 4 necesita: `loginUser`,
`loginPass`, `loginSubmit`, `navSettings`, `moduleDenied`, `publicLoginEmail`,
`publicLoginPass`, `publicLoginSubmit`). No se re-revisan (hechas fuera de este
flujo de subagentes, sin reviewer registrado); se asumen correctas salvo que
el trabajo de Task 4 en adelante tropiece con algo que las contradiga.

## Pre-flight (antes de Task 4)

- Infra local levantada para Tasks 4–9: Docker Desktop estaba apagado, se
  arrancó, y se corrió `npm run dev:infra` (postgres/redis/minio). Puertos
  5432/9000/6379 confirmados libres y saludables en este worktree (proyecto
  compose aislado `te-amo-claudia-3226b2`).
- Verificado contra el código real (no solo el plan): `GET /health/ready` en
  `apps/api/src/common/health.controller.ts` existe con el contrato exacto
  que Task 4 espera. `apps/api/scripts/reset-test-db.mjs` existe.
  `persistSession` en `App.tsx` existe. Cuentas demo `stock/vendedor/gerente/
  futbol/cocina` con esas passwords existen en
  `apps/api/prisma/seeds/users-demo.seed.cjs`. `admin/admin123` en `seed.cjs`.
  Scripts `prisma:seed` / `prisma:seed:demo` existen en `apps/api/package.json`.
- Conflict scan Tasks 4–9: Task 4 crea `e2e/` + modifica root `package.json`
  (workspaces + scripts test:db/test:e2e/test:ci). Tasks 5–8 solo agregan
  specs bajo `e2e/tests/**` sin tocar `e2e/playwright.config.ts` ni
  `start-stack.mjs` de nuevo. Task 9 (CI) consume los scripts que Task 4
  define. Sin conflictos entre tasks del rango 4–9.

**Scan result: clean.** Sin rulings necesarias antes de dispatchar Task 4.

## Task 4 — reporte del implementer (DONE_WITH_CONCERNS)

Commit `da3e8e5` — "test: harness Playwright e2e y RBAC de login admin." 4/4 tests
pasando contra stack real (Postgres/MinIO/Nest/Vite/Chromium), verificado en 3
corridas consecutivas incluyendo una tras reiniciar los contenedores.

Dos desvíos del texto literal del brief, ambos documentados con evidencia en
`task-4-report.md`:

1. **Deadlock `globalSetup` vs `webServer`**: el brief pedía el reset
   destructivo (`reset-test-db.mjs`) dentro de `global-setup.ts`, que Playwright
   corre **después** de que `webServer` ya esperó `/health/ready` — deadlock
   por construcción (confirmado leyendo `node_modules/playwright/lib/runner/index.js`
   instalado, v1.63.0, y reproducido en la primera corrida real). El
   implementer movió el reset a `start-stack.mjs` (antes de spawnear la API);
   `global-setup.ts` quedó solo con los 2 seeds idempotentes.
   Ruling: aceptado — el texto del brief era irreconciliable con el
   comportamiento real de la versión de Playwright instalada; la reubicación
   preserva la intención (reset antes de que la API sirva tráfico) sin la cual
   el harness no corre en absoluto. Costo si es incorrecto: Tasks 5-8 asumen
   que la base está reseteada+migrada en cuanto sus specs arrancan — eso sigue
   siendo cierto con el fix. Confirmado con 3 corridas limpias.
2. **`taskkill /T /F` en Windows** para matar el árbol de procesos (nest/vite)
   al cerrar `start-stack.mjs` manualmente — `child.kill()` sobre un `spawn`
   con `shell:true` en Windows solo mata el wrapper `cmd.exe`, reproducido
   manualmente. Rama POSIX sin tocar (`child.kill('SIGTERM')`).
   Ruling: aceptado — necesario para que una corrida interrumpida no deje
   puertos ocupados; no cambia el comportamiento cuando Playwright mata el
   proceso él mismo (su lógica de árbol, no la nuestra). Sin probar en Linux
   desde este entorno; queda para que el reviewer o Task 9 (CI en Linux) lo
   confirme si hace falta matar el stack manualmente ahí (Playwright no
   debería necesitarlo).

## Task 4 — review (reviewer independiente verificó el deadlock leyendo el
runtime de Playwright instalado — desvío #1 confirmado correcto)

- ✅ Spec compliant salvo el hallazgo Important de abajo. Los 8 archivos del
  brief presentes, constraints globales verificadas, sin testids nuevos.
- ⚠️ Cannot verify from diff (trailer del commit): resuelto por el
  controlador — `git log -1 --format=%B da3e8e5` confirma
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` presente.
- Important: `e2e/start-stack.mjs` importa `./constants.ts` directo con
  extensión `.ts` vía el loader ESM nativo de Node — solo funciona en
  Node ≥23.6 (sin flag) / ≥22.6 (con flag). Los Dockerfiles del proyecto
  fijan `node:20-alpine`, donde este import tira `ERR_UNKNOWN_FILE_EXTENSION`
  y el harness completo no bootea. `start-stack.mjs` es justo el archivo que
  Tasks 5-8 no van a tocar de nuevo. Confirmado real (no falso positivo):
  sin `engines` en ningún `package.json`, sin `.nvmrc`, Dockerfiles en
  Node 20.
- Minor (deferred): `global-setup.ts`/`start-stack.mjs` pasan
  `DATABASE_URL`/`DIRECT_URL` a `reset-test-db.mjs`, que en realidad lee
  `TEST_DATABASE_URL` con fallback a un literal propio — hoy coincide, pero
  el acoplamiento es implícito.
- Minor (deferred): `taskkill /T /F` en Windows sin verificar en Linux —
  aceptado, se confirma en Task 9 (CI en Actions/Linux).

**Fix round 1/5 (Important: `start-stack.mjs` no puede depender de Node ≥23.6
para importar `.ts` nativo — inlinear o resolver de forma compatible con
Node 20).**

Fix round 1/5 (1 addressed, 0 open; commits da3e8e5..bf79106 — amend). Re-review
confirmó: constantes inlineadas en `start-stack.mjs` (ya no importa `.ts`
nativo), valores verificados exactos contra `e2e/constants.ts`, 4/4 tests
siguen pasando, sin breakage nuevo.

## Tareas

- Task 1: complete (commit `283da1b`)
- Task 2: complete (commit `b6f1c59`)
- Task 3: complete (commit `e0f2bfe`)
- Task 4: complete (commit `bf79106`, fix round 1/5, review clean)
- Task 5: implementado (commit `31358d6`, DONE_WITH_CONCERNS), en revisión.
  7/7 specs verdes (2 corridas). Dos concerns no bloqueantes reportados,
  ninguno toca `apps/web-admin` ni los archivos de infra de Task 4:
  1. Bug real de carrera rol/URL en `SalesModule.tsx` (URL directa a un tab
     no-default puede caer en `mostrador` si el rol no hidrató) — no
     arreglado (fuera de alcance), evadido navegando por el nav lateral.
  2. `TablesModule.tsx` — el modal "Agregar producto" de mesas no tiene
     `data-testid` (a diferencia del resto del POS) — usó locator
     estructural (clase que inyecta Lucide) en vez de agregar un testid.
  Candidatos a `spawn_task` después del review final si se confirman.

Review: ✅ Approved. Ambos claims consecuentes verificados de forma
independiente contra el código real (testid faltante en `TablesModule.tsx`
confirmado línea por línea; el workaround de nav-click para el tab de mesas
es real y funciona, aunque el comentario inline sobre la causa raíz —
"rol no hidratado"— no queda probado: `use-local-storage.ts` lee
`localStorage` sincrónicamente en el initializer, así que la causa real del
timing es otra. No bloquea, es nota para el comentario). Dos Minor
(deferred): comentario de causa raíz impreciso en el spec; assertion extra
de heading "Pedidos" en inventario.spec.ts (aditiva, inocua).

- Task 5: complete (commit `31358d6`, review clean)
- Task 6: implementado (commit `a1cfb73`, DONE), 11/11 specs verdes, en revisión.
  Un desvío documentado: sacó el click a "Agregar sponsor" del ejemplo del
  brief porque en la UI real es el submit del form, no un abridor de modal
  (`SponsorsPanel.tsx:202-204`).

Review: ✅ Approved. El desvío se verificó correcto y necesario (clickear
"Agregar sponsor" habría disparado el submit del form antes del upload). El
round-trip a MinIO se confirmó real y no falseable (sin datos sembrados que
puedan matchear el locator antes del upload). El spec de fútbol nunca
clickea, confirmado que existían botones reales de publicar/regenerar que
podría haber tocado por accidente. Dos Minor (deferred): `.last()` vestigial
en el locator del upload; comentarios con números de línea que van a
desactualizarse.

- Task 6: complete (commit `a1cfb73`, review clean)
- Task 7: implementado (commit `8467a68`, DONE), 20/20 specs verdes (suite
  completa), en revisión. RED real encontrado: el pedido previo del seed
  demo dispara un modal "¿Repetimos?" que bloquea clicks — resuelto con un
  helper duplicado en los dos specs que hacen checkout (no extraído a
  archivo compartido, fuera del file-list del brief).

Review: ✅ Approved. El write real al backend en el checkout se verificó
(`PaymentPage.tsx` sólo navega a `/qr` tras un POST exitoso, no hay mock de
por medio). `pedidos-qr.spec.ts` es genuinamente autosuficiente. Nota:
`USE_MOCK_FUTBOL` ya estaba en `false` desde un commit anterior no
relacionado (`8f20faa`) — el reporte describe el mecanismo de mock como si
estuviera activo, pero no lo está; no afecta el código ni los tests, es una
imprecisión de la narrativa del reporte (Minor, deferred). Otro Minor: el
helper duplicado del modal es aceptable dado el file-list del brief.

- Task 7: complete (commit `8467a68`, review clean)
- Task 8: implementado (commit `b403fe5`, DONE_WITH_CONCERNS), 23/23 specs
  verdes (suite completa), en revisión con escrutinio extra porque tocó
  código de app (autorizado explícitamente por el texto del brief:
  "arreglá el KDS... o el LISTEN"):
  1. `apps/api/src/sse/sse.controller.ts` — faltaba `@Res()` en el handler,
     `/sse/events` daba 500 para cualquier cliente.
  2. `apps/web-admin/.../CocinaOnlinePanel.tsx` — el panel real de cocina
     nunca consumía SSE (solo polling de 15s); el hook con `EventSource` en
     `adapters.ts` es código muerto (además `EventSource` nativo no puede
     mandar el header `Authorization` que la ruta exige por RBAC). Fix:
     `fetch`-based stream reader con el header, dispara `reload()` on
     `kitchen-order-updated`; el polling de 15s queda de red de contención.
  Verificado con ciclo RED→GREEN real (revirtió ambos archivos vía
  `git stash`, confirmó falla determinística, restauró).

Review: ✅ Approved con 2 findings Important sobre el fix de
`CocinaOnlinePanel.tsx` (ambos verificados independientemente por el
reviewer, no bloquean por la red de contención del polling pero son gaps
reales de producción):
1. La conexión SSE nueva no manda `kitchenId` — recibe eventos de **todas**
   las cocinas (el hook muerto que reemplaza sí lo mandaba, `adapters.ts:336`
   — regresión de ese detalle). Además el efecto se re-crea en cada cambio
   de cocina sin necesidad real.
2. Sin reconexión/backoff: cualquier corte del stream (proxy, restart,
   token vencido) degrada silenciosamente y para siempre a polling de 15s
   sin señal ni auto-recuperación.
Minor (deferred): reload() del poll y del SSE pueden solaparse sin dedup;
match de frame SSE por substring en vez de parsear `event:`/`data:`; el
assert final del spec de SSE no está scoped al testid `lch-kds-ticket`.

**Fix round 1/5 (Important: agregar `kitchenId` a la conexión SSE nueva;
agregar reconexión/backoff al stream).** El implementer original perdió el
transcript por un rate limit de sesión (reset 13:30 ART) antes de aplicar el
fix — working tree quedó limpio, sin cambios parciales. Redespachado un
implementer nuevo con el contexto completo (brief + reporte + hallazgos).

Fix round 1/5 (2 addressed, 0 open; commits b403fe5..912c035). Re-review
confirmó ambos findings resueltos contra el código real:
`kitchenId` viaja en el query param (`CocinaOnlinePanel.tsx:81-83`, espeja
`adapters.ts:336`) y el efecto se re-suscribe legítimamente al cambiar de
cocina; el loop `connectOnce`/`listen` reintenta cada 3s hasta que
`cancelled` corta el bucle. Sin breakage nuevo. Dos Minor (deferred):
ventana transitoria sin filtro en el mount inicial mientras `kitchenId`
sigue en `''` (se autocorrige en el mismo ciclo de reload); el delay de
reconexión es fijo sin backoff exponencial ni tope (aceptado explícitamente
por el brief, "no necesita ser sofisticado", con el polling de 15s como red
de contención).

- Task 8: complete (commits 8467a68..912c035, fix round 1/5, review clean)
- Task 9: pendiente

## Fuera de alcance encontrado durante Task 5 (spawn_task)

- `task_ce97f599`: carrera rol/URL en tabs de Ventas (`SalesModule.tsx`).
- `task_6de4ab5b`: testid faltante en modal de productos de Mesas
  (`TablesModule.tsx`).
