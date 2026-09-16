# Red de seguridad (tests) — Diseño

**Fecha:** 2026-09-11
**Proyecto:** monorepo Sistema de Gestión LCH (`apps/api`, `apps/web-admin`, `apps/web-public`)
**Estado:** aprobado para planificación
**Siguiente:** `writing-plans` → `docs/superpowers/plans/2026-09-11-red-seguridad-tests.md`

## Problema

Antes de borrar legacy, modularizar o endurecer seguridad/eficiencia hace falta
una red que demuestre **lo que ya está hecho**. Hoy hay ~82 tests Vitest, tests
de BD en `lch_stock_test` y un `security:audit`, pero:

- No hay coverage ni umbrales en CI.
- No hay Playwright ni workflow de GitHub Actions.
- POS, checkout público y la mayoría de páginas no tienen test de UI.
- No hay e2e que cruce cantina → KDS (SSE) ni venta → stock, ni upload real a MinIO.

Sin eso, cualquier limpieza es a ciegas.

## Fuera de alcance (explícito)

- Google OAuth real (la pública se loguea con email/password de demo).
- Impresora física, Electron, APK/Capacitor.
- Redis (la API no lo usa; no se levanta para tests).
- Borrar código legacy, partir `client.ts` / `football.service.ts`, extraer
  `packages/api-client` (subproyectos 2–4).
- Regenerar o publicar el fixture completo en e2e (el motor ya tiene Vitest).
- CRUD de cada pestaña de fútbol.
- Forzar rate-limit de login a propósito.
- Coverage de `test/db` ni de Playwright (no mezclar con umbrales de Vitest).

La única modificación de producto en este ciclo: `data-testid` en anclas de
flujo y, si un god-file no se puede testear, extraer una función pura mínima.
No se reescribe POS ni se parte el API client.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance | Vitest + coverage + Playwright de **todos** los flujos web ya hechos. |
| Browser | Chromium solamente. |
| Base e2e / `test:db` | `lch_stock_test`. Nunca `lch_stock` (demo diaria). |
| Reset | `global-setup` de Playwright: migrate reset + `prisma:seed` + `prisma:seed:demo`. Un reset por corrida, no por spec. |
| Puertos e2e | API **3002**, admin **5175**, pública **5176**. No chocan con 3001/5173/5174. |
| Infra | Postgres + MinIO (`npm run dev:infra` en local; services en CI). |
| SSE | Spec cruzado: el KDS recibe el pedido **sin reload**. |
| MinIO | Upload de un PNG de fixture vía presign → PUT → confirm; `publicUrl` 200. |
| Auth pública | `POST /public/auth/login` (email/password). No `/public/auth/dev`. |
| Auth admin | `POST /auth/login` con usuarios del seed. |
| Layout Playwright | Un workspace `@lch/e2e` en `/e2e` (admin / public / cross). |
| CI | Dos jobs required: `unit` y `integrity` (db + e2e en serie). |
| Comandos | `npm test` = Vitest + coverage. `test:e2e` = Playwright. `test:ci` = unit + db + e2e. |

## Enfoques considerados

1. **Paquete `/e2e` + CI en capas.** Elegido. Un stack, un comando, specs que
   cruzan admin y pública.
2. **Playwright dentro de cada frontend.** Mejor colocation; parte los cruces
   y duplica YAML/stack.
3. **Stack e2e en Docker Compose.** Más parecido a prod; más lento y opaco en
   Windows, sin más cobertura de negocio.

## Arquitectura

Tres capas, sin mezclar responsabilidades:

| Capa | Qué cubre | Dónde | Base |
|---|---|---|---|
| Unit / integración in-memory | Dominio, mappers, guards, DTOs, helpers React | Vitest en cada app | Sin Postgres |
| Integridad de BD | Constraints, seed, stock/sales, SSE LISTEN | `apps/api` `test:db` (ya existe) | `lch_stock_test` |
| E2E navegador | Flujos web + cruces + MinIO + SSE en UI | `/e2e` Playwright Chromium | `lch_stock_test` reset + seeds |

```text
infra (Postgres + MinIO)
        │
        ├─ npm test            Vitest + coverage          (sin DB)
        │
        └─ job integrity
              test:db          reset propio de lch_stock_test
              global-setup     otro reset + seed + seed:demo
              start-stack      API :3002, Vite :5175 / :5176
              Playwright       Chromium → HashRouter (#/…)
```

Ambos frontends usan HashRouter. URLs de e2e:

- Admin: `http://127.0.0.1:5175/#/ventas`
- Pública: `http://127.0.0.1:5176/#/cantina`

`resolveApiBaseUrl()` en admin (y el equivalente público) usa
`VITE_API_URL` si está seteada, incluso siendo localhost. El stack e2e **debe**
exportar `VITE_API_URL=http://127.0.0.1:3002` al arrancar Vite; si no, caen a
`:3001` (la API de demo).

Health del stack:

- Liveness: `GET http://127.0.0.1:3002/health` → `{ status: 'ok' }`
- Ready: `GET http://127.0.0.1:3002/health/ready` → DB up. Playwright no
  arranca specs hasta que ready responda 200.

### Unidades

| Unidad | Qué hace | Cómo se usa | Depende de |
|---|---|---|---|
| Vitest + coverage | Corre tests actuales y huecos unit; falla si el umbral no se cumple | `npm test` | Nada de infra |
| `reset-test-db.mjs` | Reset Prisma de `lch_stock_test` | `test:db` y `e2e/global-setup.ts` | Postgres |
| `@lch/e2e` | Playwright, fixtures de auth, specs | `npm run test:e2e` | stack + infra |
| `e2e/start-stack.mjs` | Levanta API y ambos Vite en puertos e2e | `webServer` de Playwright | `lch_stock_test` ya sembrada, MinIO |
| `.github/workflows/test.yml` | Jobs `unit` e `integrity` | push / PR | GitHub |

## Componentes

### 1. Coverage Vitest

`@vitest/coverage-v8` en `apps/api`, `web-admin` y `web-public`. El primer
run de implementación **mide** el porcentaje actual y lo deja clavado como
piso en cada `vitest.config.ts` (no un 80 % inventado). Las carpetas críticas
`auth`, `stock`, `sales` y `public` (API) tienen un umbral un escalón más alto
que el global de esa app. `test/db/**` queda fuera del coverage de `npm test`
(como hoy: config aparte).

### 2. Huecos unit / HTTP (sin browser)

- Extraer y testear funciones puras de POS: armar ticket, descontar stock,
  mostrador vs mesa. No testear el JSX de `VentasPosContext.tsx`.
- Un happy-path HTTP (supertest o fetch contra la API de test) para venta,
  movimiento de stock, transición de cocina, pedido público y un write de
  fútbol **solo** cuando ese módulo no tenga ya un test de integración que
  cubra el mismo camino.
- Pública: completar carrito → pedido encima de `reconcile-cart.test.ts`.

### 3. Workspace `@lch/e2e`

Agregar `e2e` a `workspaces` del root.

```text
e2e/
  package.json                 # @lch/e2e, playwright
  playwright.config.ts
  global-setup.ts
  start-stack.mjs
  fixtures/auth.ts
  fixtures/ids.ts
  fixtures/files/pixel.png
  tests/admin/*.spec.ts
  tests/public/*.spec.ts
  tests/cross/*.spec.ts
```

`playwright.config.ts`: `fullyParallel` acotado (un worker contra la misma
base sembrada), `trace: retain-on-failure`, `webServer` apunta a
`start-stack.mjs` y espera `/health/ready`. Vite se arranca con
`--open false` (o equivalente) para no abrir el browser del SO; admin hoy
tiene `open: true` en `vite.config.ts`.

### 4. `data-testid`

Hoy no hay ninguno. Prefijo `lch-`. Solo anclas de flujo, no cada div.

Ejemplos canónicos (la implementación puede añadir los que el spec nombre
en `e2e/fixtures/ids.ts`):

| id | Dónde |
|---|---|
| `lch-login-user` / `lch-login-pass` / `lch-login-submit` | Login admin |
| `lch-nav-stock` / `lch-nav-ventas` / `lch-nav-online` / `lch-nav-futbol` | Shell admin |
| `lch-pos-cobrar` | POS mostrador |
| `lch-public-login-email` / `lch-public-login-pass` / `lch-public-login-submit` | Login pública |
| `lch-cantina-add` / `lch-cantina-pagar` | Cantina / pago |
| `lch-kds-ticket` | Tarjeta de pedido en cocina |
| `lch-media-file` / `lch-media-upload` | Upload CMS / fútbol |

### 5. Fixtures de auth

| Cuenta | Origen | Password | Uso |
|---|---|---|---|
| `admin` | `prisma:seed` | `admin123` | SuperAdmin, settings, CMS |
| `stock` | seed demo | `stock123` | Inventario |
| `vendedor` | seed demo | `vendedor123` | POS mostrador |
| `gerente` | seed demo | `gerente123` | Mesa, devolución, consumo |
| `futbol` | seed demo | `futbol123` | Módulo fútbol + media |
| `cocina` | seed demo | `cocina123` | KDS / SSE |
| `jugador@lachacra.test` | seed demo | `jugador123` | Cantina, perfil |
| `capitan@lachacra.test` | seed demo | `capitan123` | Ruta capitán |

`loginAdmin(rol)` y `loginPublic(email)` hacen el login por UI una vez y
guardan `storageState` por rol. Los specs reutilizan sesión para no martillar
`/auth/login` (rate limit de dev sigue activo).

Los specs que escriben usan nombres/IDs únicos (`e2e-<spec>-<ts>`) para
convivir en una sola siembra.

### 6. CI — `.github/workflows/test.yml`

**Job `unit`:** `npm ci` → `npm test` (Vitest + coverage). Sin servicios.
Artefacto: reportes `coverage/` de cada app.

**Job `integrity`:** services `postgres:16` (`POSTGRES_USER=lch`,
`POSTGRES_PASSWORD=lch_dev_pass`, `POSTGRES_DB=lch_stock`) y MinIO
(`minio/minio`, API 9000, user/pass `minio_admin` / `minio_dev_pass` como
`docker-compose.yml`). Steps, en este orden:

1. `CREATE DATABASE lch_stock_test`
2. Crear buckets `lch-media`, `lch-sponsors`, `lch-football` y dejarlos
   con download anónimo (equivalente a `minio-init` del compose). Sin esto
   el presign/PUT de CI falla.
3. `npm run test:db`
4. `npx playwright install --with-deps chromium`
5. `npm run test:e2e`

Artefactos: `playwright-report/` y traces si falla.

Ambos jobs son required en PR y push. Sin `continue-on-error`.
`npm run test:ci` es el atajo **local** (unit + db + e2e en un solo
proceso). Actions no lo usa: parte `unit` e `integrity` para que el
Vitest no espere a Playwright.

## Flujo de datos

```text
Postgres lch_stock_test          MinIO :9000 (buckets lch-*)
        ▲                              ▲
        │ DATABASE_URL / DIRECT_URL    │ MINIO_*
global-setup → migrate reset → seed → seed:demo
        │
start-stack.mjs
  API NODE_ENV=development PORT=3002
      JWT_SECRET=lch-e2e-jwt-secret-not-for-production
      DATABASE_URL=…/lch_stock_test
      MINIO_ENDPOINT=127.0.0.1 MINIO_PORT=9000 …
  admin  vite --port 5175 --strictPort  VITE_API_URL=http://127.0.0.1:3002
  pública vite --port 5176 --strictPort VITE_API_URL=http://127.0.0.1:3002
        │
Playwright Chromium
  login UI → JWT en el storage que ya usa la app
  UI fetch → API :3002 → Prisma / presign / pg_notify
```

**MinIO.** Spec `admin/media-upload`: rol con permiso de upload → input file
(`e2e/fixtures/files/pixel.png`) → `POST /media/presign` → PUT →
`POST /media/confirm` → `publicUrl` HTTP 200. Clave de objeto única
`e2e-<spec>-<ts>.png`. No se vacía el bucket (en local MinIO es el de
`dev:infra`, compartido con la demo). Si MinIO no responde, `start-stack`
falla al healthcheck; no se skipea el spec.

**SSE cocina.** La API hace `LISTEN kitchen_events` sobre `lch_stock_test`.
Spec `cross/cantina-kds-sse`: contexto A = admin `cocina` con KDS y
EventSource abierto; contexto B = pública o POS crea un pedido de cocina;
A espera `[data-testid=lch-kds-ticket]` **sin** `reload`. El test de BD
`sse-cross-instance` se mantiene. Si `LISTEN` no abre, el spec e2e falla
(no hay fallback silencioso).

**Orden en `integrity`:** health Postgres + MinIO → crear `lch_stock_test` →
`test:db` → `global-setup` → `start-stack` → Playwright.

**Unit (`npm test`)** no toca `lch_stock_test`.

## Manejo de errores

El harness falla ruidoso.

| Fallo | Comportamiento |
|---|---|
| Puerto 3002/5175/5176 ocupado | Exit ≠ 0. Mensaje: cerrá el e2e anterior. No se reusa un proceso ajeno. |
| Postgres o MinIO down | Timeout de health ~30s y abort. Local: `npm run dev:infra`. |
| migrate/seed fail | No se abre Chromium. |
| API sin `/health/ready` 200 | Playwright no arranca specs. |
| Login 401 / lockout | El fixture tira; no se entra a POS/cantina sin sesión. |
| Presign / PUT / confirm ≠ 2xx o `publicUrl` ≠ 200 | Spec media falla. |
| Pedido no aparece en KDS en el timeout | Spec SSE falla. Reload no cuenta. |
| Coverage bajo el piso | Job `unit` rojo. |
| Chromium no instala en Actions | Job `integrity` rojo. |

Timeout por spec ≈ 45s. Waits a `data-testid` o texto de negocio; prohibido
`waitForTimeout` como sincronización.

No `test.skip` / `fixme` nuevos sin comentario de motivo y fecha. No se apaga
Helmet, rate limit ni validación JWT en el stack de test.

Recuperación local: `npx playwright test --last-failed`; re-correr
`test:e2e` vuelve a resetear `lch_stock_test`. Un e2e a medias **no** toca
`lch_stock`.

## Matriz de tests

Criterio: cada flujo web ya hecho tiene al menos una capa que lo demuestra.
Playwright no duplica dominio que Vitest/BD ya cubren; entra cuando hay UI,
sesión, MinIO o SSE.

### Se mantiene

Vitest API/admin/pública existentes, `test:db` (constraints, checkout,
lockout, SSE, Berger, consumo, paginación), `npm run security:audit`.

### Unit / HTTP nueva

| Hueco | Qué se agrega |
|---|---|
| POS | Funciones puras: ticket, stock, mostrador vs mesa |
| HTTP por módulo | Happy-path de venta, movimiento, cocina, pedido público y write fútbol solo si ese camino no tiene ya test de integración |
| Pública | Carrito → pedido |
| Coverage | Piso medido + escalón extra en `auth` / `stock` / `sales` / `public` |

### Playwright — admin (`e2e/tests/admin/`)

| Spec | Actor | Éxito |
|---|---|---|
| `login-rbac` | todos los roles demo | Entra; vendedor no ve stock; cocina no ve fútbol; SuperAdmin ve settings |
| `inventario` | `stock` | `#/productos` y `#/almacenes` listan datos del seed; `#/pedidos` o movimientos muestran al menos una fila |
| `pos-mostrador` | `vendedor` | Cobra 1 ítem; ticket en historial |
| `pos-mesa-devolucion-consumo` | `gerente` | Una venta de mesa (la crea el spec si el seed no trae mesa ocupada), una devolución y un consumo $0 |
| `online-cms` | `admin` | Menú o sponsor del seed visible; tab métricas abre |
| `media-upload` | `admin` | PNG → MinIO (`lch-media`) → URL 200 |
| `futbol` | `futbol` | Equipos + fixture (lista/jornada). No regenera el torneo |
| `reportes-config` | `admin` | Reportes y `#/configuracion` abren sin error |

### Playwright — pública (`e2e/tests/public/`)

| Spec | Éxito |
|---|---|
| `paginas-invitado` | Home, torneo, cantina, fotos, reglamento renderizan |
| `auth-password` | Login jugador y capitán; perfil; capitán entra a su ruta, jugador no |
| `cantina-checkout` | Add → carrito → pago mostrador → pedido creado |
| `pedidos-qr` | Pedidos del usuario; `#/qr` abre |

### Playwright — cruces (`e2e/tests/cross/`)

| Spec | Éxito |
|---|---|
| `cantina-kds-sse` | Pedido aparece en KDS sin reload |
| `pos-stock` | Venta mostrador baja stock (UI inventario o GET API :3002) |
| `pedido-online-admin` | Pedido pública visible en admin Online/pedidos |

## Comandos

| Comando | Qué corre |
|---|---|
| `npm test` | Vitest workspaces + coverage |
| `npm run test:db` | Reset `lch_stock_test` + Vitest DB (igual que hoy) |
| `npm run test:e2e` | global-setup + stack + Playwright |
| `npm run test:ci` | `npm test` && `test:db` && `test:e2e` |
| `npm run test:admin` / `test:api` / `test:public` | Se mantienen; pasan a incluir coverage de esa app |

## Definición de hecho

1. `npm test` verde con coverage y umbrales escritos (no “después lo vemos”).
2. `npm run test:db` verde.
3. `npm run test:e2e` verde en Chromium contra 3002/5175/5176, con MinIO y SSE.
4. Actions `unit` + `integrity` en rojo bloquean el PR.
5. Este documento es la spec; el plan de implementación sale de `writing-plans`.

## Relación con el resto del hardening

Este es el **subproyecto 1**. No implementa limpieza de legacy, modularización
ni el paquete de eficiencia/seguridad. Esos ciclos empiezan cuando esta red
está verde.
