# Cerrar los fallos del recorrido de stock

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el pedido sugerido salga de los controles de stock, que la campana cumpla el texto de alertas automáticas y del día de alerta, y que el inicio general, la actividad reciente, el faltante en la ficha y el pasaje entre almacenes dejen de ser los fallos y hallazgos del informe del 2026-09-23.

**Architecture:** La cuenta del pedido es una función pura sobre `StockCountSession`. La pantalla de pedidos solo elige tipo, ventana y si redondea al pack. Las alertas semanales siguen saliendo de las ventas; se les agrega el día de alerta. Las alertas automáticas son otra regla, con un mínimo guardado en configuración (default 20). El inicio general muestra el mismo stock total que `/stock`. La actividad reciente lee `GET /settings/audit`, que ya recibe las altas. El pasaje es una transacción que mueve cantidad de un almacén a otro y escribe dos `ajuste_manual` que suman cero.

**Tech Stack:** React 18 + Vite + Vitest en `apps/web-admin`. NestJS + Prisma en `apps/api`. Sin migración: no hay enum ni columna nueva.

**Origen:** `docs/superpowers/specs/2026-09-23-test-modulo-stock-design.md` (oráculo del pedido y de las alertas) y `docs/superpowers/reports/2026-09-23-test-modulo-stock-informe.md` (qué falló).

**Estado (2026-09-25):** las tareas 1 a 8 están hechas. El recorrido en vivo se corrió con el admin en `127.0.0.1:5173` y la API en `127.0.0.1:3001`. El día real era viernes 25, no el miércoles del oráculo. F1 falló en Chrome con `type="number"` (`-999` quedaba `0999`) y se corrigió en la ficha. El informe está en `docs/superpowers/reports/2026-09-25-cerrar-fallos-stock.md`.

## Global Constraints

- El oráculo del pedido es el de ese spec. No se conserva el multiplicador 1,5 ni los “días a cubrir” de `generateMovementBasedSuggestions`.
- Un control entra por su día calendario. Si `date` empieza con `YYYY-MM-DD`, esos diez caracteres son el día. Si es un instante ISO, el día es el de `America/Argentina/Buenos_Aires`. Así el control hecho en pantalla el 2026-09-23 no pasa al 2026-09-22.
- Consumido = `expected - counted`. Puede ser negativo. No se recorta a 0 antes de promediar.
- Regular usa solo sesiones `regular`. After usa solo sesiones `after`. After no multiplica la demanda.
- Ventanas, incluido hoy: semana 7 días, mes 30, 3 meses 90, 6 meses 180. La de 6 meses usa la misma cuenta y no tiene número esperado en el recorrido en vivo.
- Si el resultado es 0 o menos, lo sugerido es 0. Con **Unidad de pedido** apagada, el positivo queda sin redondear (17,5 sigue 17,5). Con el interruptor prendido y `orderUnit > 1`, `ceil(cantidad / orderUnit) * orderUnit`. Si `orderUnit` no está o es `<= 1`, no se redondea.
- El stock actual es la suma de todos los almacenes del producto.
- La alerta semanal no cambia de fórmula. `getStockAlertProducts` sigue exigiendo promedio semanal `> 0` y `stock + pendiente < promedio`. El test que hoy dice “por debajo de 20 y sin ventas no alerta” sigue siendo cierto para esa regla.
- La alerta automática es aparte: con el interruptor prendido, stock actual `< mínimo` avisa aunque no haya ventas y aunque las notificaciones de stock bajo estén apagadas. El día de alerta no la apaga.
- El día de alerta solo filtra la alerta semanal. Los nombres son los del combo, sin acento: `Lunes`, `Martes`, `Miercoles`, `Jueves`, `Viernes`, `Sabado`, `Domingo`. El “hoy” de esa comparación es el día de `America/Argentina/Buenos_Aires`.
- Un mismo producto no sale dos veces. Si entran la semanal y la automática, queda la semanal.
- No borrar los registros `TEST-` que dejó el recorrido.
- Fuera: web pública, fútbol, online, impresora, APK, y una suite e2e nueva del recorrido entero.
- Commits al estilo del repo (`fix(stock): …`, `fix(admin): …`, `test(admin): …`). Un commit por tarea.

## Qué entra y qué no

| Informe | Qué se hace |
|---|---|
| O3, O6, O7 | El sugerido sale de los controles, con semana en el combo y con el interruptor de pack. |
| O4, O8, Z4 | Consecuencia: al sugerir 24, el pedido de `TEST` se puede guardar. No se habilita guardar cantidad 0. |
| N1, N2 | La alerta automática de mínimo (default 20) llega a la campana con stock bajo apagado. |
| N6 | La semanal solo aparece el día elegido. |
| N8 | Hay un campo de mínimo, y el texto de stock bajo deja de prometer un mínimo que no usa. |
| M4-home | `/` muestra el mismo Stock Total y los mismos pendientes que `/stock`. |
| M4-actividad | Actividad reciente hidrata las altas desde el servidor. |
| F1 | Escribir un negativo en la ficha avisa y no lo convierte en `0999`. La API ya responde 409 (F2 quedó OK). |
| P1 | Una acción de pasaje. P2 ya conservó el total con dos ajustes. |
| O5, N3, N4, N5, N7, A, B, C, R, Z1–Z3 | No se tocan. Ya cerraron. |
| Últimos 6 meses | Sigue en el combo. La cuenta es la misma con 180 días. El recorrido lo anota y no lo compara con la tabla de 24/20. |

## File structure

| File | Responsibility |
|------|----------------|
| Create: `apps/web-admin/src/features/inventory/order-suggestions.ts` | Cuenta pura del sugerido. |
| Create: `apps/web-admin/src/features/inventory/order-suggestions.test.ts` | La tabla del spec, con `today = 2026-09-23` inyectado. |
| Modify: `apps/web-admin/src/features/inventory/pages/OrdersPage.tsx` | Deja de llamar a `generateMovementBasedSuggestions`. Pasa sesiones, pack y la ventana. Agrega Semana. |
| Modify: `apps/web-admin/src/features/kitchen/domain.ts` | Borrar `generateMovementBasedSuggestions` cuando pedidos ya no lo importe. Dejar `calculateAvgDailyDemandFromMovements`: la alerta semanal lo usa. |
| Modify: `apps/web-admin/src/features/inventory/stock-alerts.ts` | Día de alerta, mínimo automático, y un solo resultado por producto. |
| Modify: `apps/web-admin/src/features/inventory/stock-alerts.test.ts` | Cubre el día, el mínimo y que la regla semanal sin ventas no dispara. |
| Modify: `apps/web-admin/src/features/inventory/pages/DashboardPage.tsx` | Lista de alertas con las dos reglas. |
| Modify: `apps/web-admin/src/features/inventory/pages/ReportsPage.tsx` | Igual, pestaña Alertas. |
| Modify: `apps/web-admin/src/features/platform/pages/PlatformDashboardPage.tsx` | Mismo criterio de alertas, y el Stock Total. |
| Modify: `apps/web-admin/src/features/platform/notifications/use-pending-notifications.ts` | La campana usa el mismo selector. La automática no depende de `stockLowNotifications`. |
| Modify: `apps/web-admin/src/features/inventory/components/StockSettingsPanel.tsx` | Campo de mínimo y textos que coinciden con la regla. |
| Modify: `apps/web-admin/src/features/platform/use-platform-state.ts` | Clave `stock.autoAlertMinimum`, default 20. |
| Modify: `apps/web-admin/src/shared/storage/keys.ts` | Clave local del mínimo. |
| Modify: `apps/web-admin/src/features/inventory/use-inventory-state.ts` | Hidratar `auditLog` desde `settingsApi.audit.list`. |
| Modify: `apps/web-admin/src/features/inventory/pages/ProductsPage.tsx` | Rechazar cantidad negativa en el input de stock. Botón Pasaje. |
| Modify: `apps/api/src/stock/stock.service.ts` | `transferStock` en una transacción. |
| Modify: `apps/api/src/stock/stock.controller.ts` | `POST /stock/products/:id/transfer`. |
| Modify: `apps/api/src/stock/dto.ts` | DTO del pasaje. |
| Modify: `apps/web-admin/src/app/api/client.ts` | Cliente del pasaje y tipo de `audit.list`. |

---

### Task 1: Sugerido desde controles

**Files:**
- Create: `apps/web-admin/src/features/inventory/order-suggestions.ts`
- Create: `apps/web-admin/src/features/inventory/order-suggestions.test.ts`

**Interfaces:**
- Consumes: `StockCountSession` de `@/features/inventory/types` y `roundUpToOrderUnit` del mismo módulo.
- Produces: `suggestFromStockCounts(input): { raw: number; suggested: number }`. Lo usa la Tarea 2.

```ts
export type SuggestionSpan = 'week' | 'month' | 'quarter' | 'halfYear';

export function suggestFromStockCounts(input: {
  sessions: StockCountSession[];
  productId: string;
  currentStock: number;
  orderUnit?: number;
  dateType: 'regular' | 'after';
  span: SuggestionSpan;
  specificDate?: string;
  packRounding: boolean;
  today: string; // YYYY-MM-DD
}): { raw: number; suggested: number };
```

- [x] **Step 1: Escribir el test que falla**

Armar las sesiones del spec con `today` fijo `2026-09-23` y stock actual 10. Unidad de pedido 24.

| Fecha | Tipo | Consumido (`expected - counted`) |
|---|---|---|
| 2026-09-23 | regular | 10 |
| 2026-09-21 | regular | 30 |
| 2026-09-22 | regular | 20 |
| 2026-09-01 | regular | 50 |
| 2026-07-23 | regular | 10 |
| 2026-09-22 | after | 40 |

Con `packRounding: true`, los `suggested` son 24, 24, 24, 24, 48 y 48 para: fecha 2026-09-21 regular, semana regular, mes regular, 3 meses regular, fecha 2026-09-22 after, semana after.

Con `packRounding: false`, los `raw` y `suggested` son 20, 10, 17.5, 14, 30 y 30.

Agregar la sesión regular del 2026-09-20 con consumido −10 (`expected: 0`, `counted: 10`). Semana regular con el interruptor apagado: `raw` 2.5. La fecha 2026-09-21 sigue en 20.

Un caso con `orderUnit: 1` y `packRounding: true` no redondea. Un caso cuyo promedio menos stock es 0 o negativo devuelve `suggested: 0`. Una sesión cuya `date` es un ISO con hora del 2026-09-23 en Argentina cuenta como ese día, no como el día UTC anterior.

Correr `npm --prefix apps/web-admin test -- src/features/inventory/order-suggestions.test.ts` y verlo fallar porque el módulo no existe.

- [x] **Step 2: Implementar la cuenta**

Días de cada span, incluido `today`: semana 7, mes 30, 3 meses 90, 6 meses 180. Restar `n - 1` días de calendario a `today`.

Si viene `specificDate`, el conjunto es solo ese día. Si no, el conjunto es el span. Filtrar por `dateType`. Consumido de una sesión para el producto: `expected - counted` de su entrada. Si el producto no está en la sesión, esa sesión no cuenta.

`raw = (suma de consumidos / cantidad de sesiones) - currentStock`. Sin sesiones, `raw = 0 - currentStock`. Si `raw <= 0`, `suggested = 0`. Si no, `suggested = packRounding ? roundUpToOrderUnit(raw, orderUnit) : raw`.

`roundUpToOrderUnit` ya no redondea cuando `orderUnit` falta o es `<= 1`, ni cuando la cantidad es `<= 0`.

- [x] **Step 3: Ver el test en verde**

`npm --prefix apps/web-admin test -- src/features/inventory/order-suggestions.test.ts`

- [x] **Step 4: Commit**

```bash
git add apps/web-admin/src/features/inventory/order-suggestions.ts apps/web-admin/src/features/inventory/order-suggestions.test.ts
git commit -m "test(admin): sugerido de pedido desde controles de stock"
```

---

### Task 2: La pantalla de pedidos usa esa cuenta

**Files:**
- Modify: `apps/web-admin/src/features/inventory/pages/OrdersPage.tsx`
- Modify: `apps/web-admin/src/features/kitchen/domain.ts`

**Interfaces:**
- Consumes: `suggestFromStockCounts`, `stockCountSessions` y `stockPackRounding` del contexto (ya están en el provider). `getTotalStock(product)` es el stock actual.
- Produces: Calcular Sugerencias escribe `suggested` con esa cuenta. Semana queda en el combo.

- [x] **Step 1: Cambiar el combo y el cálculo**

El estado de período deja de ser `periodMonths: 1 | 3 | 6`. Pasa a `SuggestionSpan`, default `month`.

Opciones, en este orden:

- `week` — Semana
- `month` — Ultimo mes
- `quarter` — Ultimos 3 meses
- `halfYear` — Ultimos 6 meses

`calculateSuggestions` filtra los productos del proveedor elegido, igual que hoy. Para cada uno llama `suggestFromStockCounts` con `today` igual al día calendario de `America/Argentina/Buenos_Aires`, `dateType`, `span`, `specificDate: calcDate || undefined` y `packRounding: stockPackRounding`.

`avgUsage` muestra el promedio de consumido (el número antes de restar el stock), no un promedio diario de ventas. `included` sigue en `suggested > 0`. `confirmOrder` sigue exigiendo `quantity > 0`: un sugerido 0 no crea pedido.

Sacar el texto “Sin historial de ventas/consumos” y “Basado en N movimiento(s) de ventas”. El texto nuevo dice que el cálculo usa los controles de stock del tipo elegido. `Ultimos 6 meses` no lleva un número de ejemplo.

La fecha específica sigue siendo opcional y, si está, manda sobre el período. El texto deja de decir “repetir ese pedido”.

- [x] **Step 2: Borrar el generador viejo de pedidos**

Quitar el import de `generateMovementBasedSuggestions`. Si ningún archivo lo importa, borrar la función y `SuggestionParams` de `domain.ts`. No borrar `calculateAvgDailyDemandFromMovements`.

- [x] **Step 3: Tests y build del admin**

`npm --prefix apps/web-admin test -- src/features/inventory/order-suggestions.test.ts`

`npm --prefix apps/web-admin run build`

- [x] **Step 4: Commit**

```bash
git commit -am "fix(stock): calcular el pedido con los controles, no con las ventas"
```

---

### Task 3: Mínimo automático y día de alerta

**Files:**
- Modify: `apps/web-admin/src/features/inventory/stock-alerts.ts`
- Modify: `apps/web-admin/src/features/inventory/stock-alerts.test.ts`
- Modify: `apps/web-admin/src/features/platform/use-platform-state.ts`
- Modify: `apps/web-admin/src/shared/storage/keys.ts`
- Modify: `apps/web-admin/src/features/inventory/components/StockSettingsPanel.tsx`
- Modify: `apps/web-admin/src/features/inventory/pages/DashboardPage.tsx`
- Modify: `apps/web-admin/src/features/inventory/pages/ReportsPage.tsx`
- Modify: `apps/web-admin/src/features/platform/pages/PlatformDashboardPage.tsx`
- Modify: `apps/web-admin/src/features/platform/notifications/use-pending-notifications.ts`

**Interfaces:**
- Consumes: `stockLowNotifications`, `stockAutoAlerts`, `stockAlertDay`, y el mínimo nuevo.
- Produces: `selectStockAlerts(input): StockAlert[]`. Campana, `/stock`, `/` y reportes lo llaman. `getStockAlertProducts` queda como la regla semanal.

- [x] **Step 1: Tests de las dos reglas**

Mantener los tres tests actuales de `getStockAlertProducts`. Agregar:

- Semanal, stock 8, venta que deja promedio por encima de 8, `alertDay: 'Jueves'`, `today` miércoles 2026-09-23: no entra.
- El mismo caso con `alertDay: 'Miercoles'`: entra.
- Sin `alertDay`, el comportamiento semanal de hoy no cambia (los tests viejos no le pasan día).
- Automática: stock 8, sin movimientos, mínimo 20, `autoAlerts: true`, `lowStockNotifications: false`: entra una alerta.
- La misma, `autoAlerts: false`: no entra. Un producto en 10 con mínimo 20 y sin ventas tampoco entra en la semanal.
- Stock 8 que cumple las dos: una sola fila, la semanal (`weeklyAvg > 0`).
- Pendiente que cubre el promedio semanal: no queda la semanal. Si la automática está prendida y 8 < 20, la automática sí queda. El recorrido N7 apaga las automáticas antes de crear el pendiente; con las automáticas apagadas el pendiente saca el producto de la lista.

- [x] **Step 2: Configuración**

En `storageKeys.inventory`, `autoAlertMinimum: 'stock-auto-alert-minimum'`.

En `usePlatformState`, estado número, default 20. Setter persiste `stock.autoAlertMinimum` con `persistRemoteConfig`, scope `stock`. Al hidratar, aceptar número. Si el valor guardado no es un número finito mayor a 0, dejar 20.

En el panel, la fila **Notificaciones de Stock Bajo** dice que avisa el día elegido cuando el stock más los pedidos pendientes no cubren el promedio semanal de ventas. La fila **Alertas Automaticas** conserva el interruptor y agrega un input numérico “Mínimo”, `min={1}`, valor el estado, al cambiar persiste el entero. La descripción dice que avisa cuando el stock baja de ese mínimo, aunque no haya ventas.

- [x] **Step 3: Un selector para las cuatro pantallas**

```ts
export function selectStockAlerts(input: {
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
  lowStockNotifications: boolean;
  autoAlerts: boolean;
  autoAlertMinimum: number;
  alertDay: string;
  today?: Date;
}): StockAlert[];
```

La semanal solo se evalúa si `lowStockNotifications` es true y `isAlertDay(today, alertDay)` es true. `isAlertDay` formatea el weekday en `America/Argentina/Buenos_Aires` y lo compara con el texto del combo. La automática, si `autoAlerts` es true, incluye productos con `productStockTotal < autoAlertMinimum`. Dedup por `product.id`: gana la semanal.

`DashboardPage`, `ReportsPage`, `PlatformDashboardPage` y `usePendingNotifications` dejan de llamar a `getStockAlertProducts` directo y llaman a `selectStockAlerts` con los flags del contexto. La campana sigue exigiendo `notificationsEnabled` y el cupo de 5. El dashboard general sigue mostrando como máximo 4. Esos cupos no cambian.

- [x] **Step 4: Tests**

`npm --prefix apps/web-admin test -- src/features/inventory/stock-alerts.test.ts`

- [x] **Step 5: Commit**

```bash
git commit -am "fix(stock): alertar por minimo automatico y por el dia elegido"
```

---

### Task 4: El inicio general muestra el Stock Total

**Files:**
- Modify: `apps/web-admin/src/features/platform/pages/PlatformDashboardPage.tsx`

**Interfaces:**
- Consumes: `products` y `getTotalStock` del contexto. `pendingOrders` ya está.
- Produces: la tarjeta Stock y Compras muestra el mismo entero que la tarjeta Stock Total de `/stock`, con el sufijo `uds`, y la misma cantidad de pedidos pendientes.

- [x] **Step 1: Mostrar el número**

`const totalStock = products.reduce((sum, product) => sum + getTotalStock(product), 0)`.

En la sección Stock y Compras, una línea `Stock Total: ${totalStock} uds` y la línea de pendientes que ya existe. Sin gráfico nuevo.

- [x] **Step 2: Build**

`npm --prefix apps/web-admin run build`

- [x] **Step 3: Commit**

```bash
git commit -am "fix(admin): mostrar el stock total en el inicio general"
```

---

### Task 5: Actividad reciente desde el servidor

**Files:**
- Modify: `apps/web-admin/src/features/inventory/use-inventory-state.ts`
- Modify: `apps/web-admin/src/app/api/client.ts`

**Interfaces:**
- Consumes: `GET /settings/audit`, que ya existe. Cada alta de almacén y de producto ya hace `POST` en `addStockAudit`.
- Produces: `auditLog` incluye esas filas aunque `localStorage` esté vacío. `DashboardPage` no cambia de componente: sigue leyendo `auditLog`.

- [x] **Step 1: Tipar la lista**

`settingsApi.audit.list` devuelve `{ id, userName, module, action, element, previousValue, newValue, createdAt }[]`, no `unknown[]`.

- [x] **Step 2: Hidratar**

En `useInventoryState`, un `useQuery` de `['settings', 'audit']` llama `settingsApi.audit.list(50)`. Al llegar datos, mapear cada fila a `AuditEntry`: `id` del servidor, `user` = `userName ?? ''`, `date` = `createdAt` formateado `es-AR`, `module` `ventas` o `stock`.

Mezclar con el log local por `id`. Si el `GET` falla, dejar el log local; no vaciar la tarjeta.

`getStockAuditEntries` sigue filtrando ventas. “Alta Producto” y “Alta Almacén” quedan en stock.

- [x] **Step 3: Build**

`npm --prefix apps/web-admin run build`

- [x] **Step 4: Commit**

```bash
git commit -am "fix(stock): leer la actividad reciente desde la auditoria del servidor"
```

---

### Task 6: La ficha no convierte un negativo en 0999

**Files:**
- Modify: `apps/web-admin/src/features/inventory/pages/ProductsPage.tsx`

**Interfaces:**
- Consumes: el input de cantidad por almacén en el modal de producto (`min={0}`).
- Produces: un valor que empieza con `-` no pisa la cantidad. Se ve el aviso “No se puede dejar el stock en negativo” y el número anterior sigue en el campo. Guardar no se llama con una cantidad negativa.

- [x] **Step 1: Rechazar el negativo en el onChange**

Si `raw` recortado empieza con `-`, o el número parseado es `< 0`, no escribir esa cantidad. Mostrar el aviso junto al bloque Stock por Almacén. El valor controlado sigue siendo la cantidad anterior, así `-999` no queda en `0999` ni en `999`.

Un vacío o un texto que no es número sigue pasando a 0, como hoy. Un entero `>= 0` limpia el aviso.

- [x] **Step 2: Bloquear el guardado**

`handleSave` vuelve sin llamar a `updateProduct` si alguna cantidad de `stockByWarehouse` es `< 0`. El aviso queda visible.

- [x] **Step 3: Build**

`npm --prefix apps/web-admin run build`

- [x] **Step 4: Commit**

```bash
git commit -am "fix(stock): avisar y no guardar un stock negativo en la ficha"
```

---

### Task 7: Pasaje entre almacenes

**Files:**
- Modify: `apps/api/src/stock/dto.ts`
- Modify: `apps/api/src/stock/stock.service.ts`
- Modify: `apps/api/src/stock/stock.controller.ts`
- Modify: `apps/web-admin/src/app/api/client.ts`
- Modify: `apps/web-admin/src/features/inventory/pages/ProductsPage.tsx`
- Modify: `apps/web-admin/src/features/inventory/use-inventory-state.ts`

**Interfaces:**
- Consumes: `adjustStock` ya bloquea la fila y rechaza negativo con 409. El pasaje hace las dos patas en la misma transacción.
- Produces: `POST /stock/products/:id/transfer` con `{ fromWarehouseId, toWarehouseId, quantity, operatorId?, operatorName? }`. El total del producto no cambia. Quedan dos movimientos `ajuste_manual`, uno negativo y uno positivo, de la misma cantidad.

- [x] **Step 1: DTO y servicio**

`quantity` es un número `> 0`. `fromWarehouseId` y `toWarehouseId` son UUID distintos. Si son iguales, 400.

En una transacción: crear el nivel de destino en 0 si no existe; bloquear las dos filas con `FOR UPDATE` en orden de id para no cruzar locks; si origen − cantidad `< 0`, `ConflictException` y no escribir ninguna de las dos; actualizar las dos cantidades; `movements.recordMany` con `ajuste_manual` de `-quantity` (referencia `Pasaje a <almacén destino>`) y `+quantity` (referencia `Pasaje desde <almacén origen>`).

No agregar un valor al enum `TipoMovimientoStock`.

- [x] **Step 2: Ruta**

Junto a `POST products/:id/stock/adjust`, `POST products/:id/transfer`, mismos roles que el ajuste.

- [x] **Step 3: Cliente y ficha**

`stockApi.products.transfer(id, body)`. En la ficha del producto, botón **Pasaje**: origen, destino (sin repetir origen), cantidad `> 0` y no mayor que el stock del origen. Al confirmar, llamar al endpoint, refrescar productos y movimientos, y `addAudit` con acción `Pasaje` y el nombre del producto. Si la API responde 409, mostrar el mensaje y no cambiar los números en pantalla.

- [x] **Step 4: Tests de API que ya cubren el 409 de stock**

No hace falta un test de base nuevo si no hay Postgres en el paso. `npm --prefix apps/api test` tiene que seguir en verde. `npm --prefix apps/api run build` también.

- [x] **Step 5: Commit**

```bash
git commit -am "fix(stock): pasar cantidad de un almacen a otro sin mover el total"
```

---


### Task 8: Recorrer solo lo que había fallado

**Files:**
- Modify: ninguno, salvo que un paso de esta tarea muestre un número distinto del oráculo. En ese caso se corrige la tarea dueña, no se edita el oráculo.

**Interfaces:**
- Consumes: el admin en `http://localhost:5173` con `admin` / `admin123`, si los tres servicios ya están levantados. Si no están, esta tarea no los arranca y queda anotada como no corrida. Las tareas 1 a 7 no dependen de este paso para compilar.

- [x] **Step 1: Pedido**

Producto con stock total 10, unidad 24, y las sesiones de la Tarea 1. Con el interruptor prendido: 24, 24, 24, 24, 48, 48. Apagado: 20, 10, 17.5, 14, 30, 30. Después del control −10, semana apagada = 2.5 y la fecha 2026-09-21 sigue en 20. Guardar el pedido de esa fecha: queda Pendiente, proveedor del producto, cantidad 24 con el interruptor prendido.

Elegir **Ultimos 6 meses**, anotar el número que muestre y no compararlo con 24 ni con 14. En vivo, con el control −10 y el pack prendido, la cantidad fue 24 y el consumo promedio 18.333.

- [x] **Step 2: Alertas**

Producto en 8, sin ventas. Automáticas prendidas, stock bajo apagado, mínimo 20: la campana lo muestra. Apagar automáticas: se va. Stock bajo prendido, día en `Jueves` un miércoles: no está. Día en `Miercoles`: está. Un pendiente que cubre el promedio semanal lo saca si las automáticas están apagadas. El recorrido cayó un viernes (2026-09-25): con el combo en `Jueves` no está y con `Viernes` está. El promedio semanal visto fue 46 y el pendiente de cobertura fue 38.

- [x] **Step 3: Inicio, actividad, ficha y pasaje**

`/` y `/stock` muestran el mismo Stock Total y los mismos pendientes. Después de un alta, Actividad Reciente muestra esa alta al recargar. En la ficha, escribir `-999` deja la cantidad anterior y el aviso; no queda `0999`. Un pasaje de 20 mueve los dos almacenes y el Stock Total no cambia.

- [x] **Step 4: Commit de la corrección de F1**

En Chrome, el input `type="number"` no entrega `-999`: el menos se pierde, el campo pasa por vacío y los dígitos quedan en `0999`. La ficha ahora usa texto, rechaza el menos en teclado, `beforeinput` y pegado, y sostiene 600 ms para que el resto de ese tipeo no pise la cantidad. El recorrido se volvió a hacer: el campo siguió en 10, apareció el aviso, y un pasaje de 20 dejó el total en 48.
