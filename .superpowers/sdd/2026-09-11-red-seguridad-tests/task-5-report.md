# Task 5 — Report: E2E admin inventario + POS + mesa/devolución/consumo

## Qué se implementó

Tres specs nuevos bajo `e2e/tests/admin/`, todos sobre la app real (sin mocks), reusando el harness del Task 4 (`ADMIN_URL`, `ids`, storageState pre-generado):

### `e2e/tests/admin/inventario.spec.ts` (`storageState: '.auth/stock.json'`)
Igual al ejemplo del brief. Verifiqué contra el código real:
- `apps/web-admin/src/features/inventory/pages/ProductsPage.tsx:116` → `<h1>Productos</h1>` (coincide exacto).
- `apps/web-admin/src/features/inventory/pages/WarehousesPage.tsx:155` → `<h1>Almacenes</h1>` (coincide con el regex `Almacenes|Depósitos`).
- `apps/web-admin/src/features/inventory/pages/OrdersPage.tsx:1074` → `<h1>Pedidos</h1>`.
- `ProductsPage.tsx:269` usa `<table>`/`<tbody>` reales.
- Único ajuste sobre el ejemplo del brief: agregué `expect(getByRole('heading', {name:'Pedidos'}))` antes del `toContainText` (el brief no lo tenía, pero es gratis dado que el h1 ya existe y hace la intención explícita). No fue necesario cambiar ningún heading — coincidían exactamente con el ejemplo del brief.

### `e2e/tests/admin/pos-mostrador.spec.ts` (`storageState: '.auth/vendedor.json'`)
Igual al ejemplo del brief salvo un ajuste: el assert final `getByText(/Ticket #|Último pedido/i)` viola "strict mode" de Playwright porque `POSModule.tsx` (líneas 228-269) renderiza **ambos** textos juntos en la tarjeta de "Último pedido" (el título de sección "Último pedido" y el texto "Ticket #1002" del ticket). Cambié el matcher a `/Ticket #\d+/` (ver `apps/web-admin/src/features/sales/pos/POSModule.tsx:243`) para apuntar solo al ticket.

### `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts` (`storageState: '.auth/gerente.json'`, un solo test)
Un solo `test(...)` con 3 pasos, misma siembra, tal como pide el brief. Tuve que apartarme del pseudocódigo del brief en varios puntos, todos verificados contra la UI real:

1. **Navegación por tab vía URL vs. nav lateral**: el brief sugiere `page.goto(...#/ventas?tab=mesas)` directo. Descubrí un problema real de carrera en la app: `apps/web-admin/src/features/sales/SalesModule.tsx` calcula el tab activo a partir de `currentUser.role` (línea 45) y, si en el primer render el rol todavía no está hidratado, cae al default (`getDefaultVentasTab`, que en `apps/web-admin/src/features/platform/config/permissions.ts:219-223` siempre devuelve `'mostrador'` para roles con acceso `'all'`), y el `useEffect` de sincronización (líneas 50-64) reemplaza la URL (`replace: true`) con `tab=mostrador`, dejando la pestaña `mesas`/`devoluciones`/`consumo` inalcanzable por URL directa. Solución: navegar una sola vez a `#/ventas` (tab default) y cambiar de pestaña clickeando los links del nav lateral (`AppLayout.tsx:119-131`, que arman `to="/ventas?tab=<tab>"`), igual que haría un usuario real. Esto también evita depender de un reload completo entre pasos (el ticket recién cobrado vive en memoria en `ctx.salesTickets`, no hace falta refetch).
   - Nota: `pos-mostrador.spec.ts` **no** tuvo este problema porque pide justamente `tab=mostrador`, que es el default — no hay discrepancia URL/rol que corregir.

2. **Selección de la cuenta recién creada**: `TablesModule.tsx` (`openTeam()`, líneas 23-39) hace `setSelected(id)` al crear la cuenta, pero en la práctica el panel de detalle no quedó montado de forma confiable tras ese primer render (posible remount del componente por el mismo tipo de re-render que causó el punto 1). Agregué un click explícito sobre el botón de la cuenta en la lista (`getByRole('button', {name: new RegExp(mesaName)})`) antes de asumir que el panel de detalle está visible. Es una interacción legítima (así seleccionaría cualquier usuario si el detalle no se abriera solo) y no depende de arreglar la causa raíz.

3. **Modal "Agregar producto" de la mesa sin `data-testid`**: a diferencia del picker de Mostrador/Consumo (`PosProductPicker.tsx`, que sí tiene `data-testid="lch-pos-product"`), el modal de "Agregar a {equipo}" de `TablesModule.tsx` (líneas 252-277) es una grilla propia **sin testid** en los botones de producto. El brief decía "agregar producto (`lch-pos-product` o `lch-mesas-agregar`)", pero en la UI real no hay `lch-pos-product` ahí. Usé un locator estructural: dentro del único overlay `.fixed.inset-0.z-50` visible, filtré los `button` que contienen un `div.text-2xl` (el emoji del producto), lo cual excluye el botón de cerrar (ícono `X` sin ese div). Para cerrar el modal antes de cobrar, usé `svg.lucide-x` — clase que Lucide-react inyecta de forma determinística en cada ícono (verificado en `node_modules/lucide-react/dist/esm/createLucideIcon.js:17-21`), no una clase de estilo arbitraria.
   - **Concern**: esto es un `data-testid` genuinamente faltante para hacer el flujo de mesas determinista sin depender de estructura DOM/clases de terceros. Lo dejo señalado en vez de tocar `TablesModule.tsx` (fuera del alcance de este task).

4. **`confirm()` nativo al cobrar la mesa**: `TablesModule.tsx:76` usa `window.confirm(...)`, manejado con `page.once('dialog', d => d.accept())` tal como especifica el brief.

5. **Modal de comprobante tras devolución**: `ReturnsModule.tsx` (líneas 217-249) abre un modal de "Comprobante de devolución" que tapa toda la UI (incluido el nav lateral) tras confirmar. No estaba en el pseudocódigo del brief. Lo cerré con el botón "Cerrar" (`getByRole('button', {name:'Cerrar', exact:true})` — hay que usar `exact` porque "Cerrar Sesión" del nav también matchea por substring) antes de pasar a la pestaña de consumo.

6. **Toasts ambiguos**: tanto "Devolución" como "Consumo" aparecen múltiples veces en pantalla (título de sección, nav lateral, comprobante, toast), violando "strict mode" con el regex genérico del brief. Usé matchers más específicos: `/Devolución #\d+ registrada/` y `/Consumo #\d+ registrado/`, apuntando al toast de confirmación real (`ReturnsModule.tsx:68`, `ConsumptionModule.tsx:48`).

7. **Producto returnable**: confirmé en `apps/web-admin/src/features/sales/pos/returnable-products.ts` que cualquier ticket `kind:'venta'` + `status:'emitido'` habilita devolución (`getReturnableQuantities`). El checkout de mesa (`printTicket`, `VentasPosContext.tsx:352-419`) llama a `salesApi.checkout` real contra el backend y agrega el ticket resultante a `ctx.salesTickets` — por eso el paso de devolución encuentra el producto recién vendido en la mesa como "Pendiente de devolver" sin necesitar seed adicional. Seleccioné el primer producto returnable con `getByRole('button', {name: /Pendiente de devolver/}).first()`.

## Qué se testeó y resultado

```
npm run test:e2e -- tests/admin
```

Corrido dos veces (para descartar flakiness) — ambas 7/7 verdes, incluyendo `login-rbac` del Task 4:

```
Running 7 tests using 1 worker

  ok 1 [setup] › tests\auth.setup.ts:4:6 › sesiones (7.0s)
  ok 2 [chromium] › tests\admin\inventario.spec.ts:6:5 › productos, almacenes y pedidos listan seed (931ms)
  ok 3 [chromium] › tests\admin\login-rbac.spec.ts:7:7 › login-rbac › vendedor no entra a inventario (713ms)
  ok 4 [chromium] › tests\admin\login-rbac.spec.ts:15:7 › cocina vs futbol › cocina no entra a futbol (711ms)
  ok 5 [chromium] › tests\admin\login-rbac.spec.ts:23:7 › superadmin settings › admin ve configuracion (905ms)
  ok 6 [chromium] › tests\admin\pos-mesa-devolucion-consumo.spec.ts:11:5 › mesa cobrada habilita devolución y registra consumo (5.0s)
  ok 7 [chromium] › tests\admin\pos-mostrador.spec.ts:11:5 › cobra un item sin imprimir (913ms)

  7 passed (36.0s)
```

Segunda corrida (repetición para confirmar estabilidad): también `7 passed (35.4s)`.

## Evidencia TDD

- **RED (Step 2 del brief)**: antes de crear los archivos, `tests/admin` solo tenía `login-rbac.spec.ts` — correr `test:e2e -- tests/admin/inventario.spec.ts` habría fallado por archivo inexistente. Tras escribir los 3 specs con el código de ejemplo del brief casi literal, la primera corrida completa mostró 2 fallos reales:
  - `pos-mesa-devolucion-consumo.spec.ts`: timeout de 45s esperando `lch-mesas-nueva` — la navegación directa por URL (`?tab=mesas`) no llegaba a esa pestaña (carrera rol/URL descrita arriba).
  - `pos-mostrador.spec.ts`: `strict mode violation` en el assert final (dos elementos matcheaban el regex genérico).
- **GREEN**: iterando selectores/navegación contra la app real (sin tocar `apps/web-admin`), llegué a 7/7 verdes de forma estable en dos corridas consecutivas.

## Archivos modificados

- `e2e/tests/admin/inventario.spec.ts` (nuevo)
- `e2e/tests/admin/pos-mostrador.spec.ts` (nuevo)
- `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts` (nuevo)

Ningún archivo de `apps/web-admin` ni de infraestructura (`playwright.config.ts`, `start-stack.mjs`) fue tocado.

## Hallazgos de autorrevisión

- No hay `waitForTimeout` en ningún spec; todas las esperas son `expect(...).toBeVisible()/toHaveCount()` o el auto-wait de `locator.click()`.
- Selectores: se prioriza `data-testid` y `getByRole` por nombre accesible. Los dos locators no basados en testid (`.fixed.inset-0.z-50` + `svg.lucide-x` para el modal de mesa) están documentados inline y señalados como concern (ver punto 3 arriba) en vez de agregar un testid nuevo fuera del alcance del task.
- El flujo de mesa+devolución+consumo queda como **un solo test**, sin dividir en tres, como pide el brief.
- Nombres únicos: `mesaName = e2e-mesa-${Date.now()}` evita colisión con otras corridas/seeds.
- Verificación real, no solo "no tira error": el cierre de mesa se valida comprobando que la cuenta desaparece de la lista (`getByText(mesaName)).toHaveCount(0)`, lo cual solo ocurre tras un `checkout` exitoso contra el backend real (`VentasPosContext.tsx` solo remueve la cuenta local si `printTicket` devuelve un ticket no nulo, es decir tras confirmación del servidor). La devolución y el consumo se validan por el toast de confirmación con el número de ticket generado por el backend (`#\d+`), no un texto estático.

## Concerns

1. **Bug de carrera rol/URL en `SalesModule.tsx`** (no arreglado, fuera de alcance): navegar directo a `#/ventas?tab=<tab-no-default>` puede aterrizar en `mostrador` si el rol del usuario no está hidratado a tiempo en el primer render, porque el efecto de sincronización de la URL usa `replace: true` con el tab por defecto. Esto afecta a cualquier navegación directa por URL a una pestaña de Ventas que no sea `mostrador` (no until ahora cubierto por otros specs). Lo evadí navegando por el nav lateral en vez de por URL. Vale la pena que alguien lo mire como bug de producto — lo marco como sugerencia para un task aparte, no lo arreglé yo mismo.
2. **`data-testid` faltante en el modal "Agregar producto" de mesas** (`TablesModule.tsx`, grilla de productos dentro del modal "Agregar a {equipo}"): no tiene testid, a diferencia del resto del flujo de POS. Usé un locator estructural robusto (basado en la clase que inyecta Lucide-react, no en clases de Tailwind) pero un testid tipo `lch-mesas-producto` sería más resistente a refactors visuales futuros.

Ninguno de los dos concerns bloquea el task; ambos están documentados para que se evalúen por separado.
