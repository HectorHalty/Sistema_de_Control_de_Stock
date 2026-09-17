# Fix wave — revisión final whole-branch (red de seguridad de tests)

Rama: `claude/subagent-dev-task-4-3fe6e4`. Base HEAD al empezar: `461ee33`.
Esta ronda arregla los 3 Critical y los 8 Important encontrados por el reviewer
independiente (Opus, solo lectura) sobre el diff completo contra `main`. Es la
única ronda de fix de la revisión final: todo lo de abajo está verificado con
comandos reales, no por lectura de código solamente (salvo C2/C3, que no se
pueden correr localmente — ver su sección).

## Resumen de verificación final

- `npm test` → **477/477 tests, 0 fallos, 0 umbrales rotos** (exit code 0).
  (La cifra "429/429" del brief era una estimación previa desactualizada; el
  número real medido hoy, con los 3 suites — api/web-admin/web-public — es
  477.)
- `npm run test:db` → **76/76 PASS** (17 archivos), contra Postgres real
  (infra Docker ya estaba arriba: `postgres`, `redis`, `minio`, healthy).
- `npm run test:e2e` → **23/23 PASS** (22 specs + 1 setup), contra la stack
  real (API + admin + público) levantada por `start-stack.mjs`.
- `.github/workflows/test.yml` (C2/C3): no se puede ejecutar localmente (no
  hay runner de Actions); se revisó línea por línea a mano y se validó la
  sintaxis YAML con `js-yaml` — ver su sección para el detalle.

## C1 — Umbrales de coverage rotos

**Qué se hizo.** Corrí `npm run test:api`, `npm run test:admin` y
`npm run test:public` para medir la cobertura real de HOY (podía diferir
levemente de la snapshot del reviewer). Los números salieron casi idénticos a
los reportados:

| threshold | configurado (antes) | medido ahora | nuevo threshold (`floor`) |
|---|---|---|---|
| api global | 28 | 24.85 | **24** |
| api `src/stock/**` | 67 | 65.21 | **65** |
| api `src/sales/**` | 74 | 66.71 | **66** |
| api `src/public/**` | 11 | 9.59 | **9** |
| web-admin | 8 | 7.40 | **7** |
| web-public | 6 | 4.95 | **4** |

Apliqué `Math.floor(actual)` en cada uno, tal como pide el brief (sin margen
extra), en:
- `apps/api/vitest.config.ts`
- `apps/web-admin/vitest.config.ts`
- `apps/web-public/vitest.config.ts`

**Evidencia.** `npm test` corrido de nuevo después del cambio: exit code 0,
cero líneas `ERROR: Coverage ... does not meet ...` en el log completo
(`grep -c "ERROR" /tmp/npmtest_full.log` → `0`).

**Nota sobre el número final de tests.** El brief esperaba "429/429"; el
número real es 477 (239 api + 187 web-admin + 51 web-public). No investigué
más a fondo el origen de la diferencia porque no afecta el criterio de
aceptación (0 fallos, 0 umbrales rotos) — lo dejo anotado para que quien siga
no se sorprenda si compara contra el brief literal.

## C1b — `src/auth/**` threshold no-op

**Qué se hizo — y por qué NO es literalmente `lines: 1`.** El brief pedía
subir el threshold a `lines: 1` como mínimo. Lo probé primero literalmente:

```
'src/auth/**': { lines: 1 },
```

Resultado real corriendo `npm run test:api`:

```
ERROR: Coverage for lines (0%) does not meet "src/auth/**" threshold (1%)
```

Confirmé con el `coverage-summary.json` que `src/auth/**` (auth.controller.ts,
auth.module.ts, auth.service.ts, jwt.strategy.ts) mide **0% real, sin ninguna
fracción oculta** (292 líneas totales, 0 cubiertas). Cualquier threshold
positivo (porcentaje) por encima de 0 rompe la suite de forma permanente, y el
brief prohíbe explícitamente agregar tests de auth nuevos en esta ronda. Un
`lines: 1` literal es por lo tanto **imposible de cumplir sin violar el propio
scope de la tarea** (no tests nuevos) o sin dejar `npm test` roto — lo cual
contradice el criterio de aceptación explícito ("429/429 verdes, cero
fallos").

**Qué hice en su lugar.** Vitest/v8 coverage soporta un modo alternativo de
threshold documentado en su propio código fuente
(`node_modules/vitest/dist/chunks/coverage.DfSpMS-b.js:4160`): *"negative
thresholds are treated as maximum uncovered counts (-X means: X lines may be
uncovered)"*. Usé ese modo en vez del porcentual:

```ts
'src/auth/**': { lines: -292 },
```

292 es el número real de líneas no cubiertas hoy (`42+69+133+48`, un archivo
por línea, confirmado vía `coverage-summary.json`). Esto:
- **No es un no-op** como el `{ lines: 0 }` original (ese threshold, en su
  semántica porcentual, exige `>= 0%` — siempre verdadero pase lo que pase).
  El nuevo threshold falla si el código de `src/auth/**` crece en líneas no
  cubiertas más allá de la línea de base actual (292): protege contra que se
  agregue una cantidad grande de código de auth completamente sin testear,
  sin exigir cobertura nueva hoy.
- Pasa con el estado real actual (0% cobertura, 292 líneas sin cubrir = el
  límite exacto).
- No requiere ningún test nuevo de auth (fuera de alcance, como pide el
  brief).

**Evidencia.** `npm run test:api` con `'src/auth/**': { lines: -292 }` →
exit code 0, sin errores de threshold para `src/auth/**`.

**Qué no se resolvió tal cual se pidió.** El valor literal `lines: 1` no se
usó por las razones de arriba. Si quien revise prefiere el no-op original
antes que este ratchet negativo, es una decisión de una línea (volver a
`{ lines: 0 }`), pero entonces C1b queda sin resolver en el sentido de "dejar
de ser no-op".

## C1c — Test roto de `suspension.engine.test.ts` (preexistente, no relacionado)

**Qué se hizo.** `apps/api/src/football/suspension.engine.ts:15-20`
(`inferInitialFechas`) devuelve `{ fechasIniciales, pendienteDefinir }`, no un
`number`. Corregí las dos aserciones en
`apps/api/test/suspension.engine.test.ts:44-45` para matchear la forma real
del objeto:

```diff
-    expect(inferInitialFechas('Tarjeta roja directa')).toBe(2);
-    expect(inferInitialFechas('Doble amarilla')).toBe(1);
+    expect(inferInitialFechas('Tarjeta roja directa')).toEqual({ fechasIniciales: null, pendienteDefinir: true });
+    expect(inferInitialFechas('Doble amarilla')).toEqual({ fechasIniciales: 1, pendienteDefinir: false });
```

No toqué la función de producción. `'Tarjeta roja directa'` matchea el regex
`/roja|expulsión|expulsion/i` → `{ fechasIniciales: null, pendienteDefinir:
true }`; `'Doble amarilla'` no matchea → `{ fechasIniciales: 1,
pendienteDefinir: false }`.

**Evidencia.** `npm run test:api` → `SuspensionEngine` pasa sus 5 tests, 0
fallos en todo el archivo.

## Verificación conjunta C1/C1b/C1c

```
$ npm test
...
Test Files  24 passed (24)   [apps/api    — 239 tests]
Test Files  29 passed (29)   [apps/web-admin — 187 tests]
Test Files   9 passed (9)    [apps/web-public — 51 tests]
$ echo $?
0
```

Cero líneas `ERROR:` en el log completo.

## C2 — `.github/workflows/test.yml`: MinIO como service container inválido

**Qué se hizo.** Saqué `minio` de `services:` en el job `integrity` (la key
`command: server /data` no es válida para un service container de Actions —
GitHub no expone `command` en ese schema, sólo `image`/`env`/`ports`/
`options`/`credentials`/`volumes`). Lo reemplacé por un step de `run` con
`docker run` directo, antes del step "MinIO buckets":

```yaml
- name: Start MinIO
  run: docker run -d --name minio -p 9000:9000 -e MINIO_ROOT_USER=minio_admin -e MINIO_ROOT_PASSWORD=minio_dev_pass minio/minio server /data
```

Agregué `timeout-minutes: 15` a los jobs `unit` e `integrity`.

Acoté el loop de `mc alias set` (antes `until ...; do sleep 1; done` sin
límite) a un máximo de 30 intentos, fallando el step explícitamente si se
agota:

```yaml
- name: MinIO buckets
  run: |
    docker run --rm --network host --entrypoint /bin/sh minio/mc -c "
      i=0
      until mc alias set local http://127.0.0.1:9000 minio_admin minio_dev_pass; do
        i=\$((i+1))
        if [ \$i -ge 30 ]; then
          echo 'MinIO no respondio dentro de 30 intentos' >&2
          exit 1
        fi
        sleep 1
      done
      mc mb local/lch-media || true
      ...
    "
```

**Verificación (no ejecutable localmente).** No hay runner de Actions
disponible en este entorno para correr el workflow de punta a punta. Lo que
sí hice:
1. Revisé línea por línea el YAML final contra la doc real de GitHub Actions
   (`services:` schema — sólo admite `image`, `credentials`, `env`, `ports`,
   `options`, `volumes`; no `command` — de ahí que el `minio:` original
   estuviera roto).
2. Parseé el archivo con `js-yaml` (`node -e "require('js-yaml').load(...)"`)
   para confirmar que no hay errores de sintaxis / indentación — el objeto
   resultante tiene exactamente los steps y jobs esperados (incluyendo el
   escapeo correcto de `\$((i+1))` y `\$i` dentro del bloque `run: |`, que
   necesitan quedar literales para que los evalúe el `sh` interno del
   container `minio/mc`, no el bash externo del runner).
3. Repliqué mentalmente la semántica de shell: el string pasado a
   `docker run ... -c "..."` tiene los `$` escapados con `\` para que el
   bash del step (el que corre `docker run ...`) no los expanda — sólo el
   `sh -c` DENTRO del container de `mc` debe verlos.

No pude confirmar en un runner real que el contenedor de MinIO arranca y
responde a tiempo; esa parte queda pendiente de una corrida real de Actions
(fuera del alcance de esta ronda, que es de solo-lectura para CI).

## C3 — Ningún job corre `prisma generate`

**Qué se hizo.** Confirmé primero que el script existe con ese nombre exacto
en `apps/api/package.json:18`: `"prisma:generate": "prisma generate"`.
Agregué, después de `npm ci`, en AMBOS jobs (`unit` e `integrity`):

```yaml
- run: npm run prisma:generate --workspace=apps/api
```

**Verificación.** Mismo alcance que C2: no ejecutable en un runner real desde
acá. Confirmé el nombre del script contra el `package.json` real (no asumido)
y validé la sintaxis YAML con `js-yaml` (ver C2).

## I4 — `auth.setup.ts` sin timeout ampliado (8 logins secuenciales en 45s)

**Qué se hizo.** Agregué `setup.setTimeout(240_000);` al principio del test
`'sesiones'` en `e2e/tests/auth.setup.ts` (la función se llama `setup`, no
`test`, porque el archivo usa `import { test as setup } from
'@playwright/test'`).

**Evidencia.** Corrida real de `npm run test:e2e`: el step `[setup] ›
tests\auth.setup.ts:4:6 › sesiones` tardó **8.9s** en esta máquina (con Vite
ya con caché tibia) — bien por debajo tanto del timeout global de 45s como del
nuevo de 240s. En un runner de Actions frío (sin caché de Vite) el margen de
240s da mucho más colchón; no puedo medir el tiempo real en un runner de
Actions desde acá, pero el fix elimina el riesgo estructural (timeout de 45s
compartiendo presupuesto con 8 logins secuenciales).

## I5 — Aserción `not.toHaveText` que nunca puede fallar

**Qué se hizo.** `e2e/tests/public/auth-password.spec.ts:20`:

```diff
-await expect(page.locator('body')).not.toHaveText(/Acceso denegado/i);
+await expect(page.locator('body')).not.toContainText(/Acceso denegado/i);
```

Mismo patrón que ya usan `online-cms.spec.ts` y `reportes-config.spec.ts`.

**Evidencia.** `npm run test:e2e`: `tests\public\auth-password.spec.ts:17:7 ›
capitan › entra a administrar-equipo` → PASS.

## I6 — Helpers duplicados entre specs

**Qué se hizo.** Extraje los 3 helpers duplicados a `e2e/fixtures/`:
- `login(request, user, pass)` → `e2e/fixtures/api.ts` (nuevo).
- `dismissRepeatOrderModal(page)` → `e2e/fixtures/cantina.ts` (nuevo).
- `pickFirstProduct(page)` → `e2e/fixtures/pos.ts` (nuevo).

Y los importé, borrando las 9 copias, en:
- `e2e/tests/cross/cantina-kds-sse.spec.ts` (`login`, `dismissRepeatOrderModal`)
- `e2e/tests/cross/pedido-online-admin.spec.ts` (`login`, `dismissRepeatOrderModal`)
- `e2e/tests/cross/pos-stock.spec.ts` (`login`)
- `e2e/tests/public/cantina-checkout.spec.ts` (`dismissRepeatOrderModal`)
- `e2e/tests/public/pedidos-qr.spec.ts` (`dismissRepeatOrderModal`)
- `e2e/tests/admin/pos-mostrador.spec.ts` (`pickFirstProduct`)
- `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts` (`pickFirstProduct`)

De paso limpié los imports de tipos (`type Page`, `type APIRequestContext`)
que quedaban sin uso en varios de estos archivos tras borrar las funciones
locales.

**Evidencia.** Los 23/23 tests de `npm run test:e2e` pasan con los imports
nuevos resolviendo en runtime (si algún import estuviera mal escrito, estos
tests hubieran fallado con "Cannot find module" o similar).

## I7 — SSE de `CocinaOnlinePanel.tsx`: reconexión sin backoff real ni chequeo de `res.ok`

**Qué se hizo** en
`apps/web-admin/src/features/online/panels/CocinaOnlinePanel.tsx`:
1. Moví `getAccessToken()` de afuera del `useEffect` (capturado una sola vez
   al montar) a **adentro de `connectOnce()`**, releyéndolo en cada intento.
2. Agregué `if (!res.ok) { ...; throw new Error(...) }` antes de leer
   `res.body`.
3. En 401/403 específicamente, seteo una bandera `stopRetrying` que corta el
   loop de `listen()` (antes reintentaba cada 3s indefinidamente con el mismo
   token vencido).

No se agregó ningún test unitario nuevo para este componente (no hay specs de
Vitest que lo cubran; verificarlo de punta a punta requeriría un test e2e que
force un 401 real, fuera de alcance de esta ronda). La verificación es de
lectura de código + que no rompe nada existente:
- `npm test` (web-admin) sigue en 187/187 verde después del cambio.
- El componente sigue usándose sin cambios de API pública (mismas props,
  mismo comportamiento visible) en `e2e/tests/cross/cantina-kds-sse.spec.ts`
  y `pedido-online-admin.spec.ts`, que pasan (23/23).

**Qué no se pudo verificar.** No armé un escenario real de token vencido
(401) contra la stack de e2e para confirmar que el loop efectivamente para —
hubiera requerido manipular el JWT_SECRET o el reloj del sistema a mitad de
test, que está fuera del alcance de una ronda de fix. El fix está limitado a
revisión de código + regresión (no rompe los flujos SSE existentes).

## I8 — (cubierto en C1b arriba)

## I9 — `start-stack.mjs`/`constants.ts` ignoran `TEST_DATABASE_URL` del entorno

**Qué se hizo.**
- `e2e/constants.ts`: `TEST_DATABASE_URL` ahora lee
  `process.env.TEST_DATABASE_URL` primero, con fallback a
  `postgresql://lch:lch_dev_pass@127.0.0.1:5432/lch_stock_test?schema=public`
  (antes `localhost` hardcodeado).
- `e2e/start-stack.mjs`: mismo cambio en su constante duplicada (duplicada a
  propósito, ver comentario existente en el archivo sobre por qué no puede
  importar `constants.ts` — Node plano sin transform de TS).

Ambos ahora siguen el mismo patrón que `apps/api/scripts/reset-test-db.mjs`
(que ya leía la env var correctamente).

**Evidencia.** `npm run test:e2e` completo (que usa `start-stack.mjs` vía
`playwright.config.ts` → `webServer.command`, y `constants.ts` vía
`global-setup.ts` y todos los specs) corrió 23/23 PASS contra la infra Docker
local, confirmando que el fallback a `127.0.0.1` sigue funcionando igual que
antes en un entorno donde no se exporta `TEST_DATABASE_URL` (como esta
máquina). No pude probar el escenario específico de CI (Actions + Docker
IPv4-only) que motivó el finding, porque no hay runner de Actions disponible
acá — el fix es el mismo patrón ya usado por `reset-test-db.mjs`, así que la
consistencia entre ambos scripts queda garantizada por construcción.

## I10 — `OnlineMediaUpload.tsx`: `onChange(url)` después de `confirm`, pierde uploads exitosos

**Qué se hizo** en
`apps/web-admin/src/features/online/OnlineMediaUpload.tsx`: invertí el orden
para que `onChange(url)` corra inmediatamente después de tener una
`publicUrl` válida (el PUT a MinIO ya fue 2xx en ese punto), y until `confirm`
en un `try/catch` propio que sólo hace `console.warn` si falla, sin
re-lanzar:

```diff
-      await mediaApi.confirm({...}, token);
-      onChange(url);
+      onChange(url);
+      try {
+        await mediaApi.confirm({...}, token);
+      } catch (confirmErr) {
+        console.warn('No se pudo confirmar el media subido en el backend', confirmErr);
+      }
```

Ahora un fallo de `confirm` no descarta una URL ya subida con éxito ni
dispara el mensaje "Error al subir" (que antes venía del `catch` externo).

**Evidencia.** `e2e/tests/admin/media-upload.spec.ts` ("PNG a MinIO y
publicUrl 200") sigue pasando (23/23 en la corrida completa de
`test:e2e`), y ese spec cubre el camino feliz completo (upload real a MinIO +
GET 200 de la URL pública) — confirma que el flujo normal no se rompió. No
armé un test que fuerce un fallo de `confirm` para verificar el camino de
error específicamente (requeriría mockear el backend o cortar la red a mitad
de request, fuera de alcance de esta ronda); la corrección es una revisión de
código de un cambio de orden + manejo de error, de bajo riesgo.

## I11 — `lch-kds-ticket` declarado pero no usado; posibles ids muertos en `ids.ts`

**Qué se hizo.**
1. Cambié las dos aserciones que buscaban el número de ticket en todo el
   `<body>`/página, para escoparlas al testid del ticket:
   - `e2e/tests/cross/cantina-kds-sse.spec.ts:77`:
     `kdsPage.getByText(padded)` → `kdsPage.getByTestId(ids.kdsTicket).getByText(padded)`
   - `e2e/tests/cross/pedido-online-admin.spec.ts:48` (mismo patrón, mismo
     componente `OnlineKitchenTicket` renderizado por `CocinaOnlinePanel`):
     `adminPage.getByText(padded)` → `adminPage.getByTestId(ids.kdsTicket).getByText(padded)`
2. Confirmé con grep, antes de tocar nada, cuáles de los 5 ids señalados por
   el reviewer (`navStock`, `navVentas`, `navOnline`, `navFutbol`,
   `mediaUpload`) están genuinamente muertos:
   - `navStock`, `navVentas`, `navOnline`, `navFutbol`: **0 usos en specs Y
     0 anclas `data-testid="lch-nav-*"` correspondientes en
     `apps/web-admin/src`** (nunca se implementaron esas anclas — sólo existe
     `lch-nav-settings`, que si tiene ancla real en `AppLayout.tsx:335` y su
     entrada en `ids.ts` se mantuvo).
   - `mediaUpload`: 0 usos en specs, pero SÍ tiene un ancla real
     (`OnlineMediaUpload.tsx:99`, el botón "Subir archivo"). El spec de media
     upload (`media-upload.spec.ts`) sube el archivo seteando el `<input
     type=file>` oculto directamente vía `ids.mediaFile` +
     `setInputFiles(...)`, sin necesitar clickear el botón visible — por eso
     `ids.mediaUpload` nunca se referencia. Borré la entrada de `ids.ts`
     (no toqué el `data-testid` del botón en el componente: sigue siendo un
     ancla `lch-` válida en la UI, sólo que hoy ningún test la necesita).
   Borré las 5 entradas de `e2e/fixtures/ids.ts`.

**Evidencia.** `npm run test:e2e` → 23/23 PASS, incluyendo
`cantina-kds-sse.spec.ts` y `pedido-online-admin.spec.ts` (los dos casos que
tocan el ticket del KDS) y `media-upload.spec.ts` (que no usa
`mediaUpload` y siguió pasando tras borrarlo de `ids.ts`).

## Archivos tocados (resumen)

```
.github/workflows/test.yml
apps/api/test/suspension.engine.test.ts
apps/api/vitest.config.ts
apps/web-admin/vitest.config.ts
apps/web-admin/src/features/online/OnlineMediaUpload.tsx
apps/web-admin/src/features/online/panels/CocinaOnlinePanel.tsx
apps/web-public/vitest.config.ts
e2e/constants.ts
e2e/fixtures/api.ts          (nuevo)
e2e/fixtures/cantina.ts      (nuevo)
e2e/fixtures/pos.ts          (nuevo)
e2e/fixtures/ids.ts
e2e/start-stack.mjs
e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts
e2e/tests/admin/pos-mostrador.spec.ts
e2e/tests/auth.setup.ts
e2e/tests/cross/cantina-kds-sse.spec.ts
e2e/tests/cross/pedido-online-admin.spec.ts
e2e/tests/cross/pos-stock.spec.ts
e2e/tests/public/auth-password.spec.ts
e2e/tests/public/cantina-checkout.spec.ts
e2e/tests/public/pedidos-qr.spec.ts
```

## Hallazgos NO resueltos o resueltos de forma distinta a lo pedido (explícito)

1. **C1b**: no se usó el valor literal `lines: 1` (rompe `npm test` sin
   agregar tests de auth, algo fuera de alcance). Se usó
   `'src/auth/**': { lines: -292 }` (semántica de "máximo de líneas no
   cubiertas", documentada en el propio Vitest), que es un ratchet real
   (no-op → deja de serlo) y pasa hoy. Ver sección C1b para el detalle
   completo y la evidencia de por qué `lines: 1` no es viable.
2. **C2/C3**: no ejecutables en un runner de Actions real desde este entorno.
   Verificados por lectura línea por línea + parseo YAML con `js-yaml`, no
   por ejecución real del workflow.
3. **I7**: el camino de error (401/403 específicamente cortando el retry) no
   se probó con un escenario real de token vencido — sólo revisión de código
   + regresión de que el camino feliz sigue funcionando.
4. **I10**: el camino de error de `confirm()` fallando no se probó con un
   escenario real — sólo revisión de código + regresión del camino feliz.
