# Stock real contra stock del sistema — Diseño

**Fecha:** 2026-09-25
**Proyecto:** monorepo Sistema de Gestión LCH (`apps/web-admin`, `apps/api`, Postgres)
**Estado:** decisiones tomadas con el dueño, incluida la del pedido sugerido. Listo para planificar.
**Ciclo:** 3. El ciclo 1 es el recorrido del módulo de ventas y el 2 son sus arreglos.

## Problema

El stock del sistema baja con cada venta tickeada. El stock real no: si un vendedor no tickea bien, si algo se rompe o si alguien se lleva mercadería, en el depósito hay menos de lo que el sistema dice. Los únicos datos reales son lo que entra por los pedidos y lo que se cuenta en el control.

El dueño necesita ver la diferencia entre los dos, por producto, cada vez que cuenta.

## Los tres números

| Número | Qué es | Cuándo existe |
|---|---|---|
| **Stock real** | Lo contado con la mano | Solo en el momento del control |
| **Stock del sistema** | Último contado, más las entradas, menos las ventas tickeadas y los consumos, más o menos los ajustes | Todo el tiempo, y se degrada entre un control y el siguiente |
| **La diferencia** | Lo que el control corrige | En cada control |

La diferencia es lo que se fue sin quedar registrado. No es un error de cuentas: es mercadería que ya no está.

## El ciclo

Un ciclo va **de un control al siguiente**. No se define por día de la semana. El dueño hoy vende los sábados y cuenta los lunes, pero la regla es que el control se haga después de la última venta del día; si algún ciclo dura diez días o tres, el modelo no cambia.

Todos los productos se cuentan en cada control, así que cada ciclo cierra completo. No hace falta llevar un último control distinto por producto.

El punto de partida de un ciclo es **el último stock contado antes de vender**. A veces, después de recibir un pedido, se vuelve a contar para asegurarse de que la recepción esté bien. Ese control pasa a ser el nuevo punto de partida, y las entradas que entraron antes ya están dentro de lo contado. La fórmula de abajo lo resuelve sola, porque solo suma las entradas que caen **entre** los dos controles.

### Ciclos con venta y ciclos sin venta

De ahí sale una propiedad útil: un ciclo que no tuvo ninguna venta no mide fuga de mostrador, mide la recepción. Si el proveedor entregó diez menos de lo que dice el remito, ese control lo muestra, y no se confunde con lo que se fue el sábado.

Pero trae un riesgo: si un ciclo sin ventas entrara al promedio del pedido sugerido, lo diluiría. Contar el lunes y volver a contar el jueves después de recibir daría dos ciclos, uno con todo el consumo y otro en cero, y el promedio quedaría a la mitad.

**Regla:** un ciclo entra al promedio del pedido solo si tuvo al menos una venta. Los ciclos sin ventas se ven igual en la pantalla de diferencias, marcados como control de recepción.

Como efecto secundario, un sábado que no se juega y no se vende tampoco baja el promedio, que es lo que corresponde: el promedio contesta cuánto se vende en un día de venta.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance del control | Se cuenta todo, en cada control |
| Granularidad | Por producto. No hace falta separar por almacén |
| Rotura | Se registra. Necesita un motivo propio en el ajuste a mano |
| Regalos | Van por Registrar Consumo, que ya existe y ya tiene su tipo de movimiento |
| Unidad de medida del reporte | Unidades. Sin plata: hoy no existe costo en el sistema y no se agrega en este ciclo |
| Tolerancia | Ninguna. Se ve la diferencia de todos los productos, no solo de los que se pasan de un umbral |
| Cuándo se cuenta | Cualquier momento, siempre después de la última venta del día. El ciclo lo define el control |

## Cómo cierra la cuenta

Por producto y por ciclo:

```
esperado   = contado del control anterior
             + entradas de pedidos del ciclo
             + devoluciones y anulaciones
             − ventas tickeadas
             − consumos internos
             − roturas

diferencia = esperado − contado

consumo real = contado anterior + entradas del ciclo − contado
             = ventas + consumos + roturas + diferencia
```

Las dos formas de escribir el consumo real dan lo mismo, y eso es lo que hace que la tabla se pueda auditar sola: si las columnas no cierran, falta un movimiento.

`contado anterior` es lo contado en el control que abre el ciclo, que puede ser el cierre del sábado pasado o un control de verificación hecho después de recibir un pedido. `entradas del ciclo` son solo las que quedaron entre los dos controles.

## El pedido sugerido pasa al consumo real

Hoy el pedido sugerido usa `esperado − contado`, es decir **la diferencia**, como si fuera el consumo del período. Eso viene del oráculo del ciclo del stock, que se definió con ejemplos sin ventas de por medio. Con las ventas enchufadas al stock, ese número dejó de significar lo que el nombre dice.

Con los números del negocio:

| | Unidades |
|---|---|
| Contado el lunes anterior | 100 |
| Entradas del ciclo | 0 |
| Vendido con ticket el sábado | 50 |
| Contado este lunes | 46 |
| Esperado por el sistema | 50 |
| **Diferencia (fuga)** | **4** |
| **Consumo real del ciclo** | **54** |

Hoy el sugerido calcula `4 − 46`, que es negativo, y sugiere **0**. Con el consumo real calcularía `54 − 46 = 8` y sugeriría **8**, o el pack redondeado hacia arriba.

El efecto es al revés de lo que conviene: cuanto mejor se tickea, más cerca de cero queda la diferencia y menos repone el sistema. Con el tickeo perfecto, nunca sugiere nada.

**Decidido:** el pedido sugerido pasa a usar el consumo real del ciclo, definido como `contado anterior + entradas de pedidos − último contado`. La diferencia queda para la pantalla de diferencias, que es donde significa algo.

El combo de ventana (semana, mes, 3 meses, 6 meses) no cambia de forma: sigue filtrando por la fecha del control que cierra cada ciclo. Lo que cambia es el número que se promedia, y que los ciclos sin ventas no entran. Con un control por semana, la ventana de un mes promedia cuatro ciclos.

El `dateType` del control (`regular` o `after`) se conserva: un ciclo hereda el tipo de su control de cierre, y el sugerido sigue separando los dos, como hoy.

Esto reescribe el oráculo del ciclo del stock y sus tests (`order-suggestions.test.ts`), que van en el mismo commit que el cambio.

## Modelo de datos

Lo que ya está y alcanza:

- `entradas_conteo` guarda `expected` y `counted` por producto en cada control. Esa es exactamente la granularidad pedida: la diferencia por producto y por ciclo ya está en la base.
- `movimientos_stock` tiene tipo, producto, cantidad con signo y fecha. Las ventas (`venta`), los consumos (`consumo`), las devoluciones (`devolucion`), las anulaciones (`venta_anulada`) y las entradas de pedidos (`entrada`) ya se distinguen.

Lo que falta:

1. **Un tipo propio para la diferencia del control.** Hoy el control escribe `ajuste_manual` con la referencia `control-stock`, la misma bolsa que una corrección a mano y que las dos patas de un pasaje entre almacenes. Se agrega `diferencia_conteo` al enum `TipoMovimientoStock`. Sin eso, ninguna columna de la tabla se puede calcular sin depender de un texto libre.
2. **Un tipo propio para el pasaje.** Las dos patas suman cero, así que hoy no rompen ningún total, pero ensucian el libro y obligan a filtrar por el texto de la referencia. Se agrega `pasaje`.
3. **Un motivo en el ajuste a mano**, con `rotura` en la lista. Los regalos no lo necesitan: van por consumo.
4. **Un tipo de control de verificación.** `sesiones_conteo.dateType` es un `String`, no un enum de la base, así que alcanza con un valor nuevo y no hace falta migración para esto. Sirve para marcar el control que se hace después de recibir un pedido.
5. **La migración re-tipea el histórico.** Los movimientos con referencia `control-stock` pasan a `diferencia_conteo` y los que empiezan con `Pasaje a` o `Pasaje desde` pasan a `pasaje`. Así los ciclos ya cargados también se pueden leer.

Detalle de Postgres que hay que respetar: agregar un valor a un enum y **usarlo** no puede pasar en la misma transacción. Son dos migraciones, una que agrega los dos valores y otra que re-tipea. Si van juntas, la migración falla.

No hace falta una tabla de ciclos: el ciclo se deriva de dos controles consecutivos y los movimientos que caen entre sus fechas.

### Un módulo puro, dos consumidores

La cuenta vive en un módulo nuevo, `apps/web-admin/src/features/inventory/stock-cycles.ts`, con una función que recibe los controles y los movimientos y devuelve, por producto y por ciclo: contado anterior, entradas, ventas, consumos, roturas, esperado, contado, diferencia, consumo real, el tipo del control de cierre y si el ciclo tuvo ventas.

De ahí comen los dos lugares: la pantalla de diferencias la muestra tal cual, y el pedido sugerido promedia el consumo real de los ciclos de la ventana. Una sola cuenta, testeada una sola vez, sin dos fórmulas que puedan separarse con el tiempo.

## La pantalla

Una pantalla de **Diferencias** en el módulo de stock, dentro de Reportes. Se elige un control y se ve la tabla completa del ciclo que ese control cierra, con una fila por producto:

| Producto | Contado anterior | Entradas | Ventas | Consumo | Rotura | Esperado | Contado | Diferencia |
|---|---|---|---|---|---|---|---|---|

Reglas de la pantalla:

- Están todos los productos contados, sin filtro y sin umbral.
- Arriba dice qué ciclo se está viendo: de qué control a qué control, cuántos días, y si tuvo ventas. Un ciclo sin ventas se muestra como control de recepción, para no leer una diferencia de remito como una fuga de mostrador.
- Se puede ordenar por diferencia para ver primero lo que más se fue.
- La diferencia se muestra en unidades y como porcentaje del consumo real, porque 3 unidades de algo que mueve 5 no es lo mismo que 3 de algo que mueve 200. El porcentaje es un agregado de lectura, no un umbral.
- Abajo, el total del ciclo: cuántas unidades salieron, cuántas explican las ventas y los consumos, y cuántas no.
- Al lado del stock de cada producto, en la ficha y en Controlar Stock, la fecha del último control. Un número contado anteayer y uno contado en julio hoy se muestran igual.

## Fuera de alcance

- Plata y costo por producto. Se puede agregar después como campo propio; no se deriva de las órdenes de compra, que guardan cantidades y no precios.
- Diferencia por almacén. El dato existe en los movimientos, pero el dueño no lo necesita.
- Atribuir la diferencia a una persona o a un turno. Con un control por ciclo no se puede sostener con datos.
- Tolerancias, umbrales y alertas por diferencia.
- Reservar stock mientras una cuenta de equipo está abierta. Eso es del ciclo 2.

## Riesgos

- **El cambio del sugerido reescribe el oráculo del pedido.** Los tests del ciclo anterior codifican la fórmula actual y hay que rehacerlos junto con el cambio, no después.
- **Un control de verificación mal marcado diluye el promedio.** Si se cuenta dos veces en una semana y el segundo control no queda marcado como verificación, la regla de "solo ciclos con venta" igual lo salva, porque entre los dos controles no hubo ventas. La marca es para que la pantalla lo explique, no para que la cuenta funcione.
- **Los ciclos viejos quedan a medias si la migración no re-tipea.** Un control anterior a la migración sin `diferencia_conteo` obliga a leer la referencia; por eso el re-tipeo va en la misma migración.
- **Un ajuste a mano sin motivo arruina una fila.** Si alguien suma stock a mano sin decir por qué, esa cantidad aparece como consumo o como diferencia según el signo. El motivo obligatorio es la defensa.
- **Un control parcial rompe el supuesto del ciclo.** Hoy se cuenta todo, pero si algún lunes se cuenta la mitad, los productos no contados arrastran su diferencia al ciclo siguiente. La pantalla tiene que decir cuáles no se contaron en vez de mostrarlos en cero.
