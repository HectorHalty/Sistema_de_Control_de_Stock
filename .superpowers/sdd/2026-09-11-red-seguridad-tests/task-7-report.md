# Task 7: E2E pública — Reporte

## Qué se implementó

Cuatro specs nuevos bajo `e2e/tests/public/`, todos consumiendo la infra ya existente de Tasks 4-6
(`e2e/constants.ts`, `e2e/fixtures/ids.ts`, `e2e/fixtures/auth.ts`, `.auth/jugador.json`,
`.auth/capitan.json` generados por `e2e/tests/auth.setup.ts`). No se tocó `playwright.config.ts`,
`start-stack.mjs`, `fixtures/auth.ts` ni ningún spec de admin.

### `paginas-invitado.spec.ts`
Contexto limpio vía `test.use({ storageState: { cookies: [], origins: [] } })` (equivalente explícito
a "sin storageState" — Playwright no permite omitir la clave y heredar el `storageState` global del
proyecto `chromium`, que no está seteado en `playwright.config.ts`, así que este override es un no-op
funcional pero documenta la intención). Recorre las 5 rutas del brief.

Ajuste sobre el ejemplo del brief: agregué `Comidas` a la regex de `#/` (`/La Chacra|Inicio|Cantina|Comidas|Torneo/i`)
porque el sidebar persistente (`apps/web-public/src/app/components/public/PublicLayout.tsx:24`) usa la
etiqueta "Comidas" y no "Cantina" para el nav de cantina — de todos modos la ruta `/` ya matchea por
"La Chacra" (`PublicLayout.tsx:82-87`, "LA CHACRA" en el sidebar) e "Inicio" (`PublicLayout.tsx:22`),
así que este ajuste es defensivo, no crítico.

Verifiqué contra el código real que cada ruta trae texto que matchea la regex del brief:
- `/` → sidebar "LA CHACRA" / "Inicio" (`PublicLayout.tsx:82-87,22`).
- `/torneo` → `<h1>Torneo La Chacra</h1>` (`TorneoPage.tsx:122`).
- `/cantina` → sidebar "Comidas" (`PublicLayout.tsx:24`), matchea `/comida/i`.
- `/fotos` → `<h1>Fotos & Videos</h1>` (`FotosPage.tsx:54`).
- `/reglamento` → `<h1>Reglamento del Torneo</h1>` (`ReglamentoPage.tsx:21,40`).

### `auth-password.spec.ts`
Igual al ejemplo del brief, sin cambios de selectores. Verificado contra el código real:
- `ProfilePage.tsx:230` renderiza `{user.email}` en texto plano → matchea `jugador@lachacra.test`.
- `CaptainRoute.tsx:10-17` redirige a `/perfil` si `!user` o `user.rol !== 'capitan'` → confirma el
  `toHaveURL(/perfil/)` para jugador y `toHaveURL(/administrar-equipo/)` para capitán.
- No existe el string "Acceso denegado" en ningún componente de `web-public` (grep confirmado) — la
  aserción `not.toHaveText(/Acceso denegado/i)` es la del brief, la dejé tal cual.
- Confirmé en `apps/api/prisma/seeds/public-accounts.seed.cjs:3-15` que las cuentas seed tienen
  `dniConfirmado` = DNI de fixture (`30123456` jugador, `28123456` capitán), requisito de
  `resolveMockRole` (`apps/web-public/src/app/mocks/futbol-identity.ts:111-127`) para resolver el rol
  mockeado correctamente — no toqué ese mecanismo.

### `cantina-checkout.spec.ts`
Mismo flujo del brief (`cantinaAdd` → `/pago` → `cantinaPagar` → `toHaveURL(/qr/)`), con dos añadidos:
1. Un helper `dismissRepeatOrderModal` que cierra el modal "¿Repetimos?" (`CantinaPage.tsx:365-380,
   RepeatOrderModal` en `CantinaPage.tsx:385-462`) si aparece. El seed de demo
   (`apps/api/prisma/seeds/online-demo.seed.cjs`) deja un pedido previo para `jugador@lachacra.test`,
   así que al entrar a `/cantina` con carrito vacío el modal se abre automáticamente y su overlay
   bloquea los clicks sobre `lch-cantina-add` (RED real: el primer run falló por
   "intercepts pointer events" hasta 45s de timeout). Sin este ajuste el spec no puede correr contra
   el sitio real.
2. Una aserción extra post-checkout: `body` contiene `/código de retiro|retiro/i`, que es el texto de
   `QrPage.tsx:73` ("Tu código de retiro está listo"), sólo visible cuando `displayOrder.qr` viene
   poblado desde la orden real devuelta por el backend.

### `pedidos-qr.spec.ts`
Autosuficiente por diseño (nota del brief): hace su propio checkout en vez de asumir que
`cantina-checkout.spec.ts` corrió antes en el mismo worker. Mismo helper de modal que el spec anterior
(duplicado localmente, no extraído a un archivo compartido para no crear un helper file "extra" fuera
de los 4 listados en el brief).

## Selector / ruta / texto: confirmado real, sin desvíos del brief salvo lo anotado arriba
- Rutas reales (`apps/web-public/src/app/components/public/PublicRouter.tsx:32-51`): `/`, `/torneo`,
  `/cantina`, `/pago`, `/pedidos`, `/qr`, `/fotos`, `/reglamento`, `/perfil`, `/administrar-equipo` —
  todas coinciden con el brief.
- `data-testid="lch-cantina-add"` (`CantinaPage.tsx:542`) y `data-testid="lch-cantina-pagar"`
  (`PaymentPage.tsx:114`) ya existían en `e2e/fixtures/ids.ts` (`cantinaAdd`, `cantinaPagar`) — no fue
  necesario agregar ningún testid nuevo.
- `publicApi.orders.checkout` (`apps/web-public/src/app/api/public-api.ts:418-426`) hace un POST real a
  `/public/orders/checkout` en la API (no es mock — `USE_MOCK_FUTBOL` sólo afecta datos de torneo). El
  `navigate('/qr')` en `PaymentPage.tsx:35` sólo ocurre tras el `await` exitoso de ese POST
  (`PaymentPage.tsx:23-42`), así que llegar a `/qr` es evidencia de escritura real en
  `lch_stock_test`.

## Qué se testeó y resultado

`npm run test:e2e -- tests/public` (10 tests: setup + 4 specs públicos):

```
Running 10 tests using 1 worker

  ok  1 [setup] › tests\auth.setup.ts:4:6 › sesiones (5.7s)
  ok  2 [chromium] › tests\public\auth-password.spec.ts:6:7 › jugador › perfil y no administra equipo (463ms)
  ok  3 [chromium] › tests\public\auth-password.spec.ts:17:7 › capitan › entra a administrar-equipo (411ms)
  ok  4 [chromium] › tests\public\cantina-checkout.spec.ts:21:5 › add carrito pago pedido (757ms)
  ok  5 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/ (499ms)
  ok  6 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/torneo (387ms)
  ok  7 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/cantina (333ms)
  ok  8 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/fotos (455ms)
  ok  9 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/reglamento (313ms)
  ok 10 [chromium] › tests\public\pedidos-qr.spec.ts:24:5 › pedidos y qr (660ms)

  10 passed (24.5s)
```

Suite completa `npm run test:e2e` (admin Tasks 4-6 + público Task 7, 20 tests):

```
Running 20 tests using 1 worker

  ok  1 [setup] › tests\auth.setup.ts:4:6 › sesiones (5.8s)
  ok  2 [chromium] › tests\admin\futbol.spec.ts:10:5 › equipos y fixture (692ms)
  ok  3 [chromium] › tests\admin\inventario.spec.ts:6:5 › productos, almacenes y pedidos listan seed (778ms)
  ok  4 [chromium] › tests\admin\login-rbac.spec.ts:7:7 › login-rbac › vendedor no entra a inventario (590ms)
  ok  5 [chromium] › tests\admin\login-rbac.spec.ts:15:7 › cocina vs futbol › cocina no entra a futbol (589ms)
  ok  6 [chromium] › tests\admin\login-rbac.spec.ts:23:7 › superadmin settings › admin ve configuracion (729ms)
  ok  7 [chromium] › tests\admin\media-upload.spec.ts:8:5 › PNG a MinIO y publicUrl 200 (736ms)
  ok  8 [chromium] › tests\admin\online-cms.spec.ts:6:5 › menu o sponsor y metricas (655ms)
  ok  9 [chromium] › tests\admin\pos-mesa-devolucion-consumo.spec.ts:11:5 › mesa cobrada habilita devolución y registra consumo (4.8s)
  ok 10 [chromium] › tests\admin\pos-mostrador.spec.ts:11:5 › cobra un item sin imprimir (773ms)
  ok 11 [chromium] › tests\admin\reportes-config.spec.ts:7:5 › reportes y config (650ms)
  ok 12 [chromium] › tests\public\auth-password.spec.ts:6:7 › jugador › perfil y no administra equipo (503ms)
  ok 13 [chromium] › tests\public\auth-password.spec.ts:17:7 › capitan › entra a administrar-equipo (394ms)
  ok 14 [chromium] › tests\public\cantina-checkout.spec.ts:21:5 › add carrito pago pedido (672ms)
  ok 15 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/ (489ms)
  ok 16 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/torneo (486ms)
  ok 17 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/cantina (322ms)
  ok 18 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/fotos (440ms)
  ok 19 [chromium] › tests\public\paginas-invitado.spec.ts:14:7 › render #/reglamento (322ms)
  ok 20 [chromium] › tests\public\pedidos-qr.spec.ts:24:5 › pedidos y qr (658ms)

20 passed (35.6s)
```

(La línea `[WebServer] [api] terminó con código 1` que aparece después de "20 passed" es Playwright
matando el proceso `start-stack.mjs`/API al finalizar el run — ocurre después de que todos los tests
ya reportaron `ok`, no es una falla de test.)

## Evidencia TDD: RED y GREEN

RED — primer intento de `cantina-checkout.spec.ts` y `pedidos-qr.spec.ts` sin el manejo del modal
"¿Repetimos?", contra el sitio público real (no una simulación — corrí `npm run test:e2e -- tests/public`
de verdad):

```
1) [chromium] › tests\public\cantina-checkout.spec.ts:7:5 › add carrito pago pedido
   - <div class="fixed inset-0 z-40 ...">…</div> intercepts pointer events
   at cantina-checkout.spec.ts:9:50  (page.getByTestId(ids.cantinaAdd).first().click())

2) [chromium] › tests\public\pedidos-qr.spec.ts:11:5 › pedidos y qr
   Test timeout of 45000ms exceeded.
   - <div class="fixed inset-0 z-40 ...">…</div> intercepts pointer events
   at pedidos-qr.spec.ts:13:50

2 failed, 8 passed (1.9m)
```

Causa raíz: `apps/api/prisma/seeds/online-demo.seed.cjs` deja un pedido de prueba previo para
`jugador@lachacra.test`, que dispara `RepeatOrderModal` en `CantinaPage.tsx:365-380` apenas se entra a
`/cantina` con el carrito vacío — su overlay (`fixed inset-0 z-40 ...`) intercepta todos los clicks.

GREEN — agregado el helper `dismissRepeatOrderModal` (click en "No, gracias",
`CantinaPage.tsx:442-449`) antes de interactuar con la grilla de productos en ambos specs:

```
  ok  4 [chromium] › tests\public\cantina-checkout.spec.ts:21:5 › add carrito pago pedido (757ms)
  ok 10 [chromium] › tests\public\pedidos-qr.spec.ts:24:5 › pedidos y qr (660ms)

  10 passed (24.5s)
```

Los otros 8 tests (páginas invitado, auth-password) pasaron en el primer intento sin ajustes.

## Archivos modificados

- `e2e/tests/public/paginas-invitado.spec.ts` (nuevo)
- `e2e/tests/public/auth-password.spec.ts` (nuevo)
- `e2e/tests/public/cantina-checkout.spec.ts` (nuevo)
- `e2e/tests/public/pedidos-qr.spec.ts` (nuevo)

Commit: `8467a68` — `test: e2e pública (páginas, login, cantina, pedidos y QR).`

## Self-review

- Los 4 specs están presentes y en verde, tanto solos (`tests/public`) como en la suite completa junto
  con los 11 tests de admin de Tasks 4-6 (ninguno se rompió).
- `pedidos-qr.spec.ts` es autosuficiente: hace su propio add-carrito → pago → checkout, no depende de
  que `cantina-checkout.spec.ts` haya corrido antes (los storageState de Playwright son por-test-file,
  así que además ni siquiera comparten contexto de navegador entre specs).
- No usé `waitForTimeout` en ningún punto; el único wait "condicional" es
  `locator.waitFor({ state: 'visible', timeout: 3000 })` sobre el botón real del modal, que es una
  espera de una condición del DOM, no un sleep fijo usado como mecanismo de sincronización.
- No se agregó ningún `test.skip`/`test.fixme`.
- No se tocó `apps/web-public` (código de la app), `playwright.config.ts`, `start-stack.mjs`,
  `fixtures/auth.ts`, `fixtures/ids.ts` ni ningún spec de `tests/admin/`.
- `USE_MOCK_FUTBOL` y `resolveMockRole` no se tocaron; sólo se consumieron sus efectos (email→rol para
  jugador/capitán) verificando que el seed real (`public-accounts.seed.cjs`) provee el `dniConfirmado`
  que ese mecanismo necesita.
- Verifiqué que el checkout de cantina genera una orden real server-side: el código de
  `PaymentPage.tsx` sólo navega a `/qr` dentro del `try` tras un `await` exitoso de un POST real a
  `/public/orders/checkout` (no hay mock de por medio ahí — sólo el fútbol usa
  `USE_MOCK_FUTBOL`), y agregué una aserción adicional sobre el texto que sólo aparece cuando
  `QrPage` recibe una orden con `qr` poblado desde esa respuesta real, además de la coincidencia de URL.

## Concerns / notas

- El testid `data-testid="lch-cantina-add"` sólo existe en el botón "+" cuando `qty === 0`
  (`CantinaPage.tsx:519-546`); una vez agregado el ítem, el control cambia a un stepper +/- sin ese
  testid. No es un problema para estos specs (cada uno agrega un solo ítem una sola vez), pero lo dejo
  anotado por si Task 8 necesita agregar más de un ítem al carrito en el mismo test — tendría que usar
  el botón "+" del stepper (sin testid) o interactuar con dos ítems distintos.
- No agregué ningún `data-testid` nuevo (no hizo falta ninguno para este task), así que no hay nada que
  reportar sobre testids faltantes en `apps/web-public`.
- El modal "¿Repetimos?" es un efecto secundario del seed de demo (pedido previo para el jugador de
  prueba) más que un requisito funcional a testear en sí — lo traté como ruido de entorno a limpiar, no
  como parte del flujo bajo prueba.
