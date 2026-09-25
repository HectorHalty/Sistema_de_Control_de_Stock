# Cierre de los fallos de stock — 2026-09-25

Ejecución del plan `docs/superpowers/plans/2026-09-25-cerrar-fallos-stock.md`. El oráculo sigue siendo el spec `docs/superpowers/specs/2026-09-23-test-modulo-stock-design.md`. El punto de partida es el informe `docs/superpowers/reports/2026-09-23-test-modulo-stock-informe.md`.

Las tareas 1 a 7 quedaron en código. La tarea 8, el recorrido en vivo, no se corrió.

## Qué se cerró

| Informe | Qué cambió |
|---|---|
| O3, O6, O7 | El sugerido sale de los controles de stock. El combo tiene Semana, Ultimo mes, Ultimos 3 meses y Ultimos 6 meses. El interruptor de pack redondea solo si está prendido y `orderUnit > 1`. |
| O4, O8, Z4 | Con el oráculo, el sugerido de 24 se puede guardar. Una cantidad 0 sigue sin crear pedido. |
| N1, N2 | La alerta automática usa un mínimo (default 20) y llega a la campana aunque las notificaciones de stock bajo estén apagadas. |
| N6 | La alerta semanal solo entra el día elegido, en `America/Argentina/Buenos_Aires`. |
| N8 | El panel tiene el campo Mínimo. El texto de stock bajo describe el promedio semanal de ventas, no un mínimo que esa regla no usa. |
| M4-home | `/` muestra `Stock Total: {suma} uds` y la misma línea de pedidos pendientes. |
| M4-actividad | Admin y SuperAdmin mezclan Actividad reciente con `GET /settings/audit`. |
| F1 | Escribir un negativo en la ficha muestra “No se puede dejar el stock en negativo” y no pisa la cantidad. Guardar tampoco acepta una cantidad menor a 0. |
| P1 | `POST /stock/products/:id/transfer` mueve cantidad en una transacción. El total del producto no cambia. |
| O5, N3, N4, N5, N7, A, B, C, R, Z1–Z3 | No se tocaron. |
| Ultimos 6 meses | Sigue en el combo. La cuenta es la misma, con ventana de 180 días. No tiene número esperado para comparar en vivo. |

Los registros `TEST-` no se borraron. No hay suite e2e nueva. Web pública, fútbol, online, impresora y APK quedaron afuera.

## Cómo está armado

La cuenta del pedido vive en `suggestFromStockCounts` (`apps/web-admin/src/features/inventory/order-suggestions.ts`). La pantalla solo elige tipo, ventana, fecha y si redondea. `generateMovementBasedSuggestions` se borró. `calculateAvgDailyDemandFromMovements` se quedó: la alerta semanal lo sigue usando. `SuggestionParams` también se quedó, porque las sugerencias de consumo de cocina lo usan.

Consumido = `expected - counted`. Puede ser negativo y no se recorta antes de promediar. Sin sesiones, el crudo es `0 - stock actual`. Si el crudo es 0 o menos, lo sugerido es 0. El stock actual es la suma de todos los almacenes.

El día de una sesión: si `date` empieza con `YYYY-MM-DD`, esos diez caracteres mandan. Si no, el instante se lee en `America/Argentina/Buenos_Aires`. Un control del 2026-09-23 a las 00:30 UTC cuenta como el 23, no como el 22. Regular y after no se mezclan. After no multiplica la demanda. El subtítulo del botón After dejó de decir “mayor demanda”.

Ventanas, incluido hoy: semana 7, mes 30, trimestre 90, semestre 180. Con el dataset del oráculo y `today = 2026-09-23`, el semestre coincide con el trimestre porque el control del 2026-07-23 entra en los 90 días. En vivo hay que anotar el número de 6 meses y no compararlo con 24 ni con 14.

La fecha específica manda sobre el período. El texto de la pantalla dice “Usando los controles del …”, no que se repite un pedido anterior.

`getStockAlertProducts` no cambió de fórmula: promedio semanal `> 0` y `stock + pendiente < promedio`. El test “por debajo de 20 y sin ventas no alerta” sigue siendo de esa función. `selectStockAlerts` es el que usan `/stock`, reportes, `/` y la campana.

- La semanal se evalúa solo si las notificaciones de stock bajo están prendidas y hoy es el día del combo (`Lunes` … `Domingo`, sin acento).
- La automática, si está prendida, incluye productos con stock actual `< mínimo`. El día de alerta no la apaga. Tampoco hace falta que haya ventas.
- Un producto entra una sola vez. Si cumplen las dos, queda la fila semanal.
- Un pendiente que cubre el promedio saca la semanal. Si la automática sigue prendida y el stock está bajo el mínimo, el producto queda por la automática. El recorrido N7 apaga las automáticas antes de ese pendiente: con las automáticas apagadas, el pendiente saca el producto.
- La campana sigue pidiendo notificaciones del sistema y muestra como máximo 5. El inicio general muestra como máximo 4 alertas.

El mínimo se guarda como `stock.autoAlertMinimum`, scope `stock`, y en local como `stock-auto-alert-minimum`. Si el valor no es un número finito mayor a 0, queda 20. El input solo persiste un entero `>= 1`. `normalizeAutoAlertMinimum` trunca con `floor`.

El interruptor de alertas automáticas ya venía prendido en el recorrido y el default local es `true`. Antes ese interruptor no se leía. A partir de este cambio, un producto bajo el mínimo aparece aunque no tenga ventas. El producto `TEST` en stock 10 entra en esa lista si las automáticas están prendidas. Para volver a mirar N6 hay que apagar las automáticas: el día de alerta no las esconde.

`GET /settings/audit` sigue limitado a `SETTINGS_ROLES` (Admin, SuperAdmin y Gerente de ventas). El hook de inventario pide la lista solo con rol Admin o SuperAdmin, para no recibir un 403 en cada pantalla de Operador_Stock. Esa query no está en `hydrationQueries`: si falla, no marca el inventario como offline y no vacía el log local.

La mezcla no es por `id`. La fila local nace como `a{timestamp}` y la del servidor es un uuid. Se reconoce la misma alta por módulo, acción y elemento. Las filas del servidor se conservan todas. Dos altas locales de la misma acción y el mismo elemento se pliegan en la fila del servidor hasta que el refetch las traiga. Después de `addStockAudit` se invalida `['settings', 'audit']`.

El pasaje no agrega un valor a `TipoMovimientoStock` ni una migración. `TransferStockDto` exige UUID de origen y destino, cantidad `>= 0.001`, y operador opcional. El servicio rechaza el mismo almacén (400), redondea a 3 decimales y exige cantidad `> 0`, crea el nivel de destino en 0 si falta, bloquea las dos filas con `FOR UPDATE` ordenadas por id, y si el origen quedaría negativo responde 409 “No hay stock suficiente en el almacén de origen” sin escribir ninguna de las dos. Los movimientos son `ajuste_manual`: `-cantidad` con referencia `Pasaje a {destino}` y `+cantidad` con `Pasaje desde {origen}`. Los nombres se cortan a 80 caracteres.

`transferStockError` es el control de la ficha. El límite de verdad es el servidor. La ficha llama al endpoint, refresca productos y movimientos, y deja un audit `Pasaje`.

## Verificación

`npm --prefix apps/api run prisma:generate` hizo falta antes de los tests de API: sin el cliente de Prisma, `@IsEnum(UnidadMedida)` y `Prisma.TransactionIsolationLevel` quedaban indefinidos y varias suites ni arrancaban.

Después de generarlo:

- `npm --prefix apps/api test`: 24 archivos, 240 tests, en verde. Incluye `transferStock mueve cantidad sin cambiar el total y rechaza el faltante` (mueve 4, el total sigue en 10, referencias `Pasaje a TEST-B` y `Pasaje desde Depósito`, mismo almacén y faltante no escriben).
- `npm --prefix apps/api run build`: en verde.
- `npm --prefix apps/web-admin test` y `npm --prefix apps/web-admin run build`: en verde. El admin con coverage no se puede correr por un solo archivo: el umbral global de líneas es 7 % y un subconjunto lo rompe.

Los tests del sugerido fijan `today = 2026-09-23`, stock 10 y unidad 24. Con pack: 24, 24, 24, 24, 48, 48. Sin pack: 20, 10, 17.5, 14, 30, 30. Con el control regular del 2026-09-20 consumido −10, la semana sin pack da 2.5 y la fecha 2026-09-21 sigue en 20. `orderUnit` 1 no redondea. El semestre coincide con el trimestre en ese dataset.

El texto de After ya no dice “mayor demanda”, y la fecha específica dice “Usando los controles del …”. Esa copia no cambia la cuenta. La suite de API (24 archivos, 240 tests) y la del admin se volvieron a correr después de ese ajuste y siguieron en verde.

## Recorrido en vivo

No se hizo. `curl` a `http://localhost:5173` y `http://localhost:3001` devolvió HTTP 000. El plan dice no arrancar los tres servicios si no están levantados. Los pasos de la tarea 8 siguen abiertos en el plan.

Cuando haya stack, el recorrido es solo lo que había fallado: el oráculo de pedido (anotando 6 meses sin compararlo), alertas con la automática apagada para mirar el día, el mismo Stock Total en `/` y `/stock`, la alta en Actividad reciente al recargar, `-999` en la ficha, y un pasaje cuyo total no cambia.

## Commits

Sobre `cursor/plan-cerrar-fallos-stock-5ff4`, después del plan `23b6d33`:

| Commit | Qué cierra |
|---|---|
| `b7feb12` test(admin): sugerido de pedido desde controles de stock | Tarea 1 |
| `b200095` fix(stock): calcular el pedido con los controles, no con las ventas | Tarea 2 |
| `9d31ff4` fix(stock): alertar por minimo automatico y por el dia elegido | Tareas 3 y 4. El inicio general vive en el mismo archivo que las alertas de `/`. |
| `78fe739` fix(stock): auditar actividad, rechazar negativo y pasar entre almacenes | Tareas 5, 6 y 7. La ficha, el cliente y el estado de inventario comparten los tres cambios. |

`package-lock.json` no entra: `npm install` solo le sacó campos `libc` de paquetes opcionales. No se commiteó `node_modules`.
