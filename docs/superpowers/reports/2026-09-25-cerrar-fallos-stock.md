# Cierre de los fallos de stock — 2026-09-25

Ejecución del plan `docs/superpowers/plans/2026-09-25-cerrar-fallos-stock.md`. El oráculo sigue siendo el spec `docs/superpowers/specs/2026-09-23-test-modulo-stock-design.md`. El punto de partida es el informe `docs/superpowers/reports/2026-09-23-test-modulo-stock-informe.md`.

Las tareas 1 a 8 quedaron hechas. El recorrido en vivo se corrió el viernes 2026-09-25 contra el admin en `127.0.0.1:5173` y la API en `127.0.0.1:3001`. Esta base arrancó vacía de productos: no había registros `TEST-` para conservar ni borrar. Los datos del recorrido son `WALK-TEST`, `WALK-ALERTA`, `WALK-PASAJE` y el almacén `WALK-ALTA`.

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
| F1 | Escribir `-999` en la ficha muestra “No se puede dejar el stock en negativo” y la cantidad anterior sigue. Guardar tampoco acepta una cantidad menor a 0. El primer guardia en `onChange` no alcanzaba en Chrome: ver el recorrido. |
| P1 | `POST /stock/products/:id/transfer` mueve cantidad en una transacción. El total del producto no cambia. |
| O5, N3, N4, N5, N7, A, B, C, R, Z1–Z3 | No se tocaron. |
| Ultimos 6 meses | Sigue en el combo. La cuenta es la misma, con ventana de 180 días. No tiene número esperado para comparar en vivo. |

En esta base no había registros `TEST-`. No se borró ninguno. No hay suite e2e nueva. Web pública, fútbol, online, impresora y APK quedaron afuera.

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

El rechazo del negativo vive en `stock-quantity-input.ts`. El campo de stock de la ficha es texto: Chrome no entrega un menos en un input numérico, y ese era el camino que convertía `-999` en `0999`.

## Verificación

`npm --prefix apps/api run prisma:generate` hizo falta antes de los tests de API: sin el cliente de Prisma, `@IsEnum(UnidadMedida)` y `Prisma.TransactionIsolationLevel` quedaban indefinidos y varias suites ni arrancaban.

Después de generarlo:

- `npm --prefix apps/api test`: 24 archivos, 240 tests, en verde. Incluye `transferStock mueve cantidad sin cambiar el total y rechaza el faltante` (mueve 4, el total sigue en 10, referencias `Pasaje a TEST-B` y `Pasaje desde Depósito`, mismo almacén y faltante no escriben).
- `npm --prefix apps/api run build`: en verde.
- `npm --prefix apps/web-admin test` y `npm --prefix apps/web-admin run build`: en verde. El admin con coverage no se puede correr por un solo archivo: el umbral global de líneas es 7 % y un subconjunto lo rompe.

Los tests del sugerido fijan `today = 2026-09-23`, stock 10 y unidad 24. Con pack: 24, 24, 24, 24, 48, 48. Sin pack: 20, 10, 17.5, 14, 30, 30. Con el control regular del 2026-09-20 consumido −10, la semana sin pack da 2.5 y la fecha 2026-09-21 sigue en 20. `orderUnit` 1 no redondea. El semestre coincide con el trimestre en ese dataset.

El texto de After ya no dice “mayor demanda”, y la fecha específica dice “Usando los controles del …”. Esa copia no cambia la cuenta. La suite de API (24 archivos, 240 tests) y la del admin se volvieron a correr después de ese ajuste y siguieron en verde.

## Recorrido en vivo

Postgres 16, la API y el admin se levantaron en esta máquina. Docker no está. La semilla no crea productos. Hoy era viernes 2026-09-25, así que el día de alerta se probó con `Jueves` (no) y `Viernes` (sí), no con el miércoles del oráculo. Los números de pedido no cambian entre el 23 y el 25: las mismas sesiones siguen adentro de las ventanas.

Pedido de `WALK-TEST`, stock 10, unidad 24:

| Caso | Pack prendido | Pack apagado |
|---|---|---|
| Fecha 2026-09-21 | 24 | 20 |
| Semana | 24 | 10 |
| Ultimo mes | 24 | 17.5 |
| Ultimos 3 meses | 24 | 14 |
| After, fecha 2026-09-22 | 48 | 30 |
| After, semana | 48 | 30 |

Después del control regular 2026-09-20 con consumido −10, la semana sin pack dio 2.5 y la fecha 2026-09-21 siguió en 20. Con el pack otra vez prendido, esa fecha guardó un pedido pendiente de 24. **Ultimos 6 meses**, con ese control y el pack prendido, mostró cantidad 24 y consumo promedio 18.333. Se anota y no se compara con 24 ni con 14.

Alertas de `WALK-ALERTA` en 8, con una venta de −200 (promedio semanal 46):

- Automáticas prendidas, stock bajo apagado, mínimo 20: la campana muestra `WALK-ALERTA: 8 uds restantes` y también `WALK-TEST: 10 uds restantes`.
- Automáticas apagadas y stock bajo apagado: `WALK-ALERTA` sale de la campana.
- Stock bajo prendido, automáticas apagadas, día `Jueves` un viernes: no está en reportes.
- Día `Viernes`: está, promedio semanal 46. Un pendiente de 38 la saca.

Inicio y `/stock` mostraron `Stock Total: 48 uds` y 2 pedidos pendientes.

Actividad reciente lista la acción `Alta Almacén`. El nombre `WALK-ALTA` está en el detalle de esa fila y en `entradas_auditoria`. La primera lectura falló porque buscaba el nombre en la lista, que muestra usuario y acción.

F1 en Chrome: con `type="number"`, escribir `-999` dejó `0999` y no apareció el aviso. El navegador no manda el menos; manda vacío y después los dígitos se pegan a un 0. La ficha pasó a `type="text"`. `rejectStockKey` y `stockEditIntroducesMinus` cortan el menos en teclado, `beforeinput` y pegado, y dejan un bloqueo de 600 ms para que el resto de ese `-999` no reemplace la cantidad. `parseStockQuantityDraft` sigue rechazando un texto con menos. Al rehacer el paso, el campo quedó en 10 y el aviso se vio.

Pasaje de 20 de `WALK-PASAJE` desde Depósito Principal a Quincho Bar: el origen quedó en 10, el destino en 20, y el Stock Total siguió en 48.

Al terminar, la configuración remota quedó con redondeo de pack prendido, notificaciones de stock bajo prendidas, alertas automáticas apagadas y día de alerta `Viernes`.

## Commits

Sobre `cursor/plan-cerrar-fallos-stock-5ff4`, después del plan `23b6d33`:

| Commit | Qué cierra |
|---|---|
| `b7feb12` test(admin): sugerido de pedido desde controles de stock | Tarea 1 |
| `b200095` fix(stock): calcular el pedido con los controles, no con las ventas | Tarea 2 |
| `9d31ff4` fix(stock): alertar por minimo automatico y por el dia elegido | Tareas 3 y 4. El inicio general vive en el mismo archivo que las alertas de `/`. |
| `78fe739` fix(stock): auditar actividad, rechazar negativo y pasar entre almacenes | Tareas 5, 6 y 7. La ficha, el cliente y el estado de inventario comparten los tres cambios. |
| `fix(stock): el menos en la ficha no se convierte en 0999` | Corrección de F1 del recorrido, más el informe de la tarea 8. |

`package-lock.json` no entra: `npm install` solo le sacó campos `libc` de paquetes opcionales. No se commiteó `node_modules`.
