# Task 4 — Harness `@lch/e2e` + login RBAC — Reporte

## Fix post-review — import de `.ts` en `start-stack.mjs` rompía en Node 20

Review encontró (Important, must-fix): `start-stack.mjs` importaba `./constants.ts` directamente vía el loader ESM nativo de Node (`import { API_URL, TEST_DATABASE_URL, JWT_SECRET } from './constants.ts'`). Eso solo resuelve sin flags desde Node ≥23.6 (≥22.6 con flag) — funcionaba en esta máquina (Node v24.19.0) pero el repo no tiene `engines` ni `.nvmrc`, y los Dockerfiles de `apps/api` y `apps/web-admin` fijan `node:20-alpine`. En Node 20, ese `import` tira `ERR_UNKNOWN_FILE_EXTENSION` y el harness completo no arranca — relevante porque Task 9 (CI) va a correr esto, probablemente sobre Node 20 dado los Dockerfiles.

**Fix aplicado** (opción sugerida por el reviewer): saqué el `import ... from './constants.ts'` de `start-stack.mjs` y dupliqué los 3 valores que usa (`API_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`) como constantes literales al tope del archivo, con un comentario explicando por qué (este archivo lo corre un `node` plano vía `webServer.command`, no el runner de Playwright, que sí transforma TS antes de ejecutar — por eso `playwright.config.ts`, `global-setup.ts`, `fixtures/auth.ts`, etc. pueden seguir importando de `constants.ts` sin problema, y no los toqué). Dejé una nota en el comentario para mantenerlos en sync si `constants.ts` cambia.

Verificación:

```
$ npm run test:e2e
...
Running 4 tests using 1 worker

  ok 1 [setup] › tests\auth.setup.ts:4:6 › sesiones (9.9s)
  ok 2 [chromium] › tests\admin\login-rbac.spec.ts:7:7 › login-rbac › vendedor no entra a inventario (890ms)
  ok 3 [chromium] › tests\admin\login-rbac.spec.ts:15:7 › cocina vs futbol › cocina no entra a futbol (719ms)
  ok 4 [chromium] › tests\admin\login-rbac.spec.ts:23:7 › superadmin settings › admin ve configuracion (877ms)

  4 passed (34.4s)
[exited with code 0]
```

Bonus: el warning `MODULE_TYPELESS_PACKAGE_JSON` que aparecía en corridas anteriores (por el `import` de un `.ts` sin `"type"` en `package.json`) desapareció de la salida de `[WebServer]`, confirmando que ya no se importa ningún `.ts` desde `start-stack.mjs`. Confirmé también que no quedaron procesos colgados en 3002/5175/5176 después de la corrida.

No hice commit nuevo separado — voy a amendear el commit `da3e8e5` para mantener esto en un solo commit de la task, según lo indicado por el coordinador.

## Qué se implementó

Workspace `e2e/` completo (Playwright), integrado al monorepo vía npm workspaces:

- `e2e/package.json` — `@lch/e2e`, solo `test:e2e` (sin `test`), `devDependencies: @playwright/test ^1.55.0`.
- `e2e/constants.ts` — `API_URL`, `ADMIN_URL`, `PUBLIC_URL`, `TEST_DATABASE_URL`, `JWT_SECRET` (verbatim del brief).
- `e2e/playwright.config.ts` — Chromium only (`devices['Desktop Chrome']`), `workers: 1`, `timeout: 45_000`, `reuseExistingServer: false`, proyecto `setup` (auth.setup.ts) del que depende `chromium` (los specs).
- `e2e/global-setup.ts` — corre los seeds (`prisma:seed`, `prisma:seed:demo`) contra `apps/api` con `DATABASE_URL`/`DIRECT_URL` apuntando a `lch_stock_test`.
- `e2e/start-stack.mjs` — completo (no esqueleto): puertos libres (3002/5175/5176), poll de infra (TCP 5432 + `GET :9000/minio/health/live`, 30s), **reset de la base de test** (ver desvío abajo), spawn de API (`npx nest start`, sin watch) + Vite admin (5175) + Vite pública (5176) con `VITE_API_URL=http://127.0.0.1:3002`, poll de `/health/ready` (60s), y limpieza de los 3 hijos en SIGTERM/SIGINT.
- `e2e/fixtures/auth.ts` — `adminAccounts`, `publicAccounts`, `loginAdmin`, `loginPublic` (verbatim del brief, usando los testids de `e2e/fixtures/ids.ts` ya existente de Task 3).
- `e2e/tests/auth.setup.ts` — loguea las 6 cuentas admin + 2 públicas y guarda `storageState` en `.auth/<rol>.json`.
- `e2e/tests/admin/login-rbac.spec.ts` — los 3 casos RBAC del brief, verbatim.
- Root `package.json` — `workspaces: ["apps/*", "e2e"]`, scripts `test:db`, `test:e2e`, `test:ci` agregados. `test` (`--workspaces --if-present`) sigue siendo solo Vitest: confirmado que `@lch/e2e` no tiene script `test`, así que `--if-present` lo saltea sin error.

## Desvío del brief — deadlock `globalSetup` vs `webServer` (documentado y verificado)

El brief da `global-setup.ts` haciendo `reset-test-db.mjs` + los 2 seeds, y `playwright.config.ts` con `webServer.url = '${API_URL}/health/ready'`. Con el Playwright instalado (v1.63.0) esto **no puede funcionar**: leí el runtime instalado (`node_modules/playwright/lib/runner/index.js`) y confirmé que:

- `createGlobalSetupTasks` arma la lista de tareas como `[removeOutputDirs, ...pluginSetupTasks (webServer incluido), ...globalTeardowns, ...globalSetups]` — es decir, el plugin de `webServer` corre **antes** que `globalSetup`.
- `TaskRunner.runDeferCleanup` itera esa lista con `await task.setup(...)` secuencial — no hay concurrencia entre tareas.
- `WebServerPlugin.setup()` hace `await this._startProcess(); await this._waitForProcess();`, y `_waitForProcess()` bloquea hasta que la URL (`/health/ready`) responda 2xx/3xx o se cumpla el timeout (180s de nuestro config).

Como `/health/ready` depende de que Postgres tenga la base `lch_stock_test` migrada, y esa migración vivía en `globalSetup` (que corre después), quedaba en deadlock: lo reproduje en la primera corrida real (`npm run test:e2e`), que colgó hasta que mi propio poll interno de 60s en `start-stack.mjs` abortó con "Timeout esperando: http://127.0.0.1:3002/health/ready" y Playwright reportó "Process from config.webServer was not able to start."

Además, aunque moviera el chequeo de `webServer.url` a `/health` (liveness, sin DB) para esquivar el primer deadlock, en una **segunda corrida** la API ya tendría una conexión Prisma abierta a una base `lch_stock_test` existente, y `prisma migrate reset --force` no puede `DROP DATABASE` con sesiones activas — rompería la reproducibilidad del harness que las Tasks 5-8 necesitan.

**Fix aplicado:** moví el paso destructivo (`node scripts/reset-test-db.mjs`) de `global-setup.ts` a `start-stack.mjs`, ejecutado sincrónicamente (`spawnSync`) justo después del poll de infra y **antes** de spawnear la API. `global-setup.ts` quedó solo con los 2 seeds (idempotentes, `upsert`), que corren después de que Playwright ya confirmó `/health/ready` — momento en el que la base ya existe y está migrada, así que la API arranca sin la advertencia de "Database does not exist" salvo que el operador corra `start-stack.mjs` de forma standalone sin el reset (no es el caso en `test:e2e`).

Verifiqué esto corriendo la suite completa **tres veces consecutivas** (incluyendo una después de parar/reiniciar los contenedores de Postgres/MinIO) — las tres pasaron limpio, sin conexiones colgadas ni fallos de `DROP DATABASE`.

Dejo esto marcado explícitamente porque Tasks 5-8 no van a tocar `playwright.config.ts` ni `start-stack.mjs` de nuevo — si el reviewer prefiere otra solución (p.ej. cambiar `webServer.url` a `/health` y aceptar el riesgo de reruns), avisar antes de que las tasks siguientes construyan sobre este harness.

## Otro ajuste no-verbatim: Windows process-tree kill

En Windows, `spawn(cmd, args, { shell: true })` crea un `cmd.exe` intermedio; `child.kill('SIGTERM')` sobre ese PID mata solo el wrapper, no el proceso real (nest/vite) que quedaba colgado con el puerto tomado — lo reproduje manualmente (maté el wrapper, los 3 procesos reales de nest/vite/vite quedaron vivos y con los puertos ocupados). Cambié `killChildren()` para usar `taskkill /pid <pid> /T /F` en `win32` (mata el árbol completo) y `child.kill('SIGTERM')` en POSIX. No afecta lo que ve Playwright (que mata el `webServer` process con su propia lógica de árbol), pero sí importa para Ctrl+C manual y para que una corrida fallida no deje puertos ocupados para la siguiente.

## Qué se testeó y resultados

### RED (Step 1 del brief — antes de tener el harness)

```
$ npx playwright test -c e2e/playwright.config.ts
Error: D:\...\e2e\playwright.config.ts does not exist
    at resolveConfigFile2 ...
```

Falla exactamente como predice el brief: "no config". En ese punto solo existía `e2e/tests/admin/login-rbac.spec.ts`.

### GREEN (Step 4 — `npm run test:e2e`, corrida final tras el fix de ordering)

```
> sistema-gestion-lch@2.0.0 test:e2e
> npm run test:e2e --workspace=@lch/e2e

> test:e2e
> playwright test

> @lch/api@0.1.0 prisma:seed
> node prisma/seed.cjs
Seeding database...
Usuario admin creado. Password temporal: admin123 — CAMBIARLA YA.
Scheduling: 3 grupos, 8 categorías.
Reglamento: 8 apartados, 56 artículos, 5 anexos.
Taxonomía web: 2 categorías, 4 filtros.
Seed complete.

> @lch/api@0.1.0 prisma:seed:demo
> node prisma/seed-demo.cjs
Seeding demo data...
Inventario: 15 productos, 3 proveedores, niveles de stock.
Torneo demo: 6 equipos, categoría Libre A, jornada 1.
Torneos bootstrap: 8 categorías en Apertura.
Cantina pública: 7 ítems, 2 categorías, 4 filtros, recetas vinculadas.
Usuario sistema "online" creado para checkout web.
Cuentas públicas: capitan@lachacra.test (capitán) y jugador@lachacra.test (jugador) — password: *123
Online demo: 4 filtros web, 3 medios, pedidos de prueba.
Usuarios demo: stock/stock123, vendedor/vendedor123, gerente/gerente123, futbol/futbol123, cocina/cocina123
Demo seed complete.

Running 4 tests using 1 worker

  ok 1 [setup] › tests\auth.setup.ts:4:6 › sesiones (7.1s)
  ok 2 [chromium] › tests\admin\login-rbac.spec.ts:7:7 › login-rbac › vendedor no entra a inventario (823ms)
  ok 3 [chromium] › tests\admin\login-rbac.spec.ts:15:7 › cocina vs futbol › cocina no entra a futbol (702ms)
  ok 4 [chromium] › tests\admin\login-rbac.spec.ts:23:7 › superadmin settings › admin ve configuracion (925ms)

  4 passed (27.6s)
```

Corrida contra la stack real: Postgres 16 en Docker (`lch_stock_test`, reset+migrado en cada corrida), MinIO real, Nest API real (`localhost:3002`), Vite admin real (`127.0.0.1:5175`) sirviendo el build de dev de React, y Chromium real (headless) navegando y logueándose con las 6 cuentas admin + 2 públicas de los seeds reales. Nada mockeado.

Repetí la corrida completa 3 veces (incluyendo una después de `docker stop`/`start` de postgres+minio) — las 3 pasaron limpio y sin procesos ni puertos colgados después de cada una.

### Casos de error verificados manualmente (además del happy path)

- **Puerto en uso**: ocupé `127.0.0.1:3002` con un listener dummy y corrí `node start-stack.mjs` standalone → salió con exit code 1 e imprimió exactamente `puerto en uso, cerrá el e2e anterior`.
- **Infra caída**: paré los contenedores de Postgres y MinIO, corrí `node start-stack.mjs` standalone → tras ~30s imprimió `Timeout esperando: Postgres (5432) + MinIO (9000)` y `Infra no disponible — levantá "npm run dev:infra" antes de correr e2e.`, exit 1. Reinicié los contenedores después y confirmé que la suite completa volvía a pasar.
- **SIGTERM/SIGINT**: confirmé que tras una corrida (exitosa o fallida) de `npm run test:e2e`, no quedan procesos escuchando en 3002/5175/5176 — Playwright mata el árbol completo del `webServer` de forma confiable en Windows (usa su propia lógica, no depende de que nuestro proceso maneje la señal).

## Archivos modificados/creados

- `e2e/package.json` (nuevo)
- `e2e/constants.ts` (nuevo)
- `e2e/playwright.config.ts` (nuevo)
- `e2e/global-setup.ts` (nuevo — sin el paso de reset, ver desvío)
- `e2e/start-stack.mjs` (nuevo — completo, incluye el reset movido + taskkill en Windows)
- `e2e/fixtures/auth.ts` (nuevo)
- `e2e/tests/auth.setup.ts` (nuevo)
- `e2e/tests/admin/login-rbac.spec.ts` (nuevo)
- `package.json` (modificado — workspaces + scripts test:db/test:e2e/test:ci)
- `package-lock.json` (modificado — instalación de `@playwright/test` en el workspace)

No toqué `e2e/fixtures/ids.ts` (ya existía de Task 3, se importa tal cual).

## Self-review

- Completitud: los 8 archivos del brief están, con el contenido verbatim donde el brief lo daba (constants.ts, fixtures/auth.ts, auth.setup.ts, login-rbac.spec.ts, playwright.config.ts, package.json de e2e y root).
- Los dos desvíos (reset movido a start-stack.mjs, taskkill en Windows) están documentados arriba con evidencia técnica, no son gold-plating — sin ellos el harness no corre en absoluto o deja procesos colgados.
- No agregué testids nuevos ni toqué `apps/web-admin`/`apps/web-public` — Task 3 ya dejó todo lo necesario.
- No usé `waitForTimeout` en ningún lado — todos los waits son `expect(...).toHaveCount/toBeVisible` o polls con condición explícita.
- No agregué `test.skip`/`test.fixme`.
- `e2e/.auth/`, `e2e/playwright-report/`, `e2e/test-results/` ya estaban en `.gitignore` (de un intento anterior o previsión del plan) — no hizo falta tocarlo.
- El warning `MODULE_TYPELESS_PACKAGE_JSON` (Node avisando que `constants.ts` no declara "type") es cosmético — no rompe nada, lo dejé así para no agregar campos que el brief no pidió en `e2e/package.json`.

## Concerns para el reviewer

1. El desvío del deadlock `globalSetup`/`webServer` es el cambio más importante a revisar — confirmar que mover el reset a `start-stack.mjs` es aceptable, ya que Tasks 5-8 no van a tocar estos archivos de nuevo.
2. El `taskkill /T /F` en Windows es específico de plataforma; en Linux (probable target de Task 9/CI) usa `child.kill('SIGTERM')` normal — no lo pude probar en Linux desde este entorno Windows, pero es el patrón estándar para árboles de procesos POSIX con grupos de proceso reales.
