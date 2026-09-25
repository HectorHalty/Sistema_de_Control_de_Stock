# Test en vivo del módulo de ventas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recorrer el módulo de ventas completo y dejar un informe que diga, paso por paso, si el dinero, el stock y las comandas cierran entre pantallas y en la base, con atención especial al alta y la baja de cocinas, recetas, productos e impresoras.

**Architecture:** una cocina es la estación de retiro que se imprime en el ticket, no una cola de trabajo: los pasos que la miran comprueban lo que sale impreso y las filas de `ordenes_cocina` como dato. Este ciclo no cambia código. Se crean datos con prefijo `VTA-` por pantalla, salvo los tickets con fecha anterior y las dos ventas simultáneas, que van por API o por SQL porque la pantalla no puede hacerlos. Cada paso se compara contra el oráculo del spec y se anota en el informe.

**Tech Stack:** admin React + Vite en `127.0.0.1:5173`, API NestJS en `127.0.0.1:3001`, Postgres local `lch_stock`. Login `admin` / `admin123`.

**Origen:** `docs/superpowers/specs/2026-09-25-test-modulo-ventas-design.md` (oráculo del dinero, del stock, de las métricas y de los permisos).

**Ciclo:** este es el ciclo 1 de 2. El ciclo 2 se planifica a partir del informe.

## Global Constraints

- No se modifica código. Si un paso muestra un número distinto del oráculo, se anota y se sigue. No se edita el oráculo para que cierre.
- El total de un ticket es la suma de precio por cantidad. No hay descuentos, ni IVA, ni caja.
- La cantidad de un producto de venta es un entero mayor a 0. Lo fraccionado vive solo en las recetas.
- Cada venta, devolución parcial y consumo suma 1 al contador de `contadores_ticket`. Se anota el contador antes de empezar.
- La cantidad de una salida de stock es negativa. La referencia del movimiento es el UUID del ticket.
- El nivel de cada insumo tiene que ser igual a la suma de sus movimientos, en cada corte del recorrido.
- Los datos `VTA-` no se borran al final, salvo `VTA-INS-C`, que se borra a propósito como parte del paso de bajas.
- Cada control de configuración se anota antes de tocarlo y se restaura al terminar.
- Fuera: el módulo Online, la web pública, la pantalla de cocina, fútbol, la APK y el módulo de stock. Imprimir contra una IP real: no hay impresora.
- El informe va a `docs/superpowers/reports/2026-09-25-test-modulo-ventas-informe.md`, con una línea por paso.

## Formato del informe

Una línea por paso, como en el recorrido de stock:

```
PASO V1 | OK/FALLO/HALLAZGO | esperado: <número o conducta> | visto: <qué pasó> | <pantalla o tabla>
```

`FALLO` es un número o una conducta que contradice el oráculo. `HALLAZGO` es algo que funciona pero no coincide con lo que promete su etiqueta, o una carencia.

## Libro de stock esperado

`VTA-INS-A` arranca en 24 unidades, repartidas 10 en Depósito Principal y 14 en Quincho Bar. El reparto entre almacenes es por orden de id, así que el oráculo fija el total del producto y el informe anota de qué almacén salió cada unidad.

| Paso | Operación | A | B | KG | C |
|---|---|---|---|---|---|
| inicio | — | 24 | 3 | 10 | 20 |
| V1 | 2 × `VTA-SIMPLE` | 20 | 3 | 10 | 20 |
| V2 | 1 × `VTA-SIMPLE` + 1 × `VTA-OTRA-COCINA` | 18 | 2 | 10 | 20 |
| V3 | 1 × `VTA-COMBO` | 14 | 2 | 10 | 20 |
| V4 | 2 × `VTA-KILO` | 14 | 2 | 9,5 | 20 |
| V5 | 1 × `VTA-MIXTO` | 13 | 2 | 9,5 | 19 |
| V7 | dos ventas simultáneas de 2 × `VTA-OTRA-COCINA` | 13 | 0 | 9,5 | 19 |
| C1 | consumo de 1 × `VTA-SIMPLE` | 11 | 0 | 9,5 | 19 |
| D1 | venta de 3 × `VTA-SIMPLE` | 5 | 0 | 9,5 | 19 |
| D2 | devolución de 1 de esa venta | 7 | 0 | 9,5 | 19 |
| D3 | anulación de esa misma venta | 11 | 0 | 9,5 | 19 |

El paso D3 es el que decide el fallo grave: lo correcto es volver a 11, porque de los 6 descontados ya se devolvieron 2. Si la pantalla o la base terminan en 13, la anulación devolvió de más.

---

### Task 0: Preparación

**Files:** ninguno.

- [ ] **Step 1: Servicios arriba**

`curl http://127.0.0.1:3001/health` y `curl http://127.0.0.1:5173` tienen que responder 200. Postgres levantado con `pg_ctlcluster 16 main start` si hace falta.

- [ ] **Step 2: Anotar el estado inicial**

Contador de tickets, cantidad de tickets existentes, y el valor de cada control de Configuración → Ventas: validación de stock al vender, protección de concurrencia, plantilla del ticket e impresoras cargadas.

```sql
SELECT valor FROM contadores_ticket WHERE id = 'default';
SELECT COUNT(*) AS tickets, MAX(number) AS ultimo FROM tickets_venta;
SELECT key, value FROM configuraciones WHERE key LIKE 'sales%';
```

- [ ] **Step 3: Usuarios de prueba**

Crear por API un usuario `vta-vendedor` con rol Vendedor y otro `vta-gerente` con rol Gerente de ventas. Se usan en la Task 10.

---

### Task 1: Maestros de ventas

**Files:** ninguno.

- [ ] **Step 1: Insumos de inventario**

Crear `VTA-INS-A` (unidades, 10 en Depósito Principal y 14 en Quincho Bar), `VTA-INS-B` (unidades, 3 en Depósito Principal), `VTA-INS-KG` (kg, 10) y `VTA-INS-C` (unidades, 20). Se crean desde la pantalla de productos del módulo de stock.

```
PASO M1 | esperado: los cuatro insumos con su stock | pantalla de productos de stock
```

- [ ] **Step 2: Cocinas y categoría**

Crear las cocinas `VTA-COCINA-1` y `VTA-COCINA-2` y la categoría de venta `VTA-CAT` desde Ventas → Productos.

```
PASO M2 | esperado: dos cocinas activas y la categoría en el combo | Ventas → Productos
```

- [ ] **Step 3: Productos de venta**

Crear los seis productos de la tabla del spec: `VTA-SIMPLE`, `VTA-COMBO` (promo de 2 × `VTA-SIMPLE`), `VTA-KILO`, `VTA-MIXTO`, `VTA-SIN-RECETA` y `VTA-OTRA-COCINA`.

- [ ] **Step 4: Disponible calculado**

En el editor de producto y en el mostrador, el disponible tiene que ser: `VTA-SIMPLE` 12, `VTA-COMBO` 6, `VTA-KILO` 40, `VTA-MIXTO` 20, `VTA-OTRA-COCINA` 3, `VTA-SIN-RECETA` 0 o sin número.

```
PASO M3 | esperado: 12, 6, 40, 20, 3 y 0 | Ventas → Productos y Mostrador
```

- [ ] **Step 5: Nombre repetido en la misma cocina**

Intentar crear otro `VTA-SIMPLE` en `VTA-COCINA-1`. La base tiene `@@unique([name, kitchenId])`: tiene que fallar con un mensaje, no con un error crudo. El mismo nombre en `VTA-COCINA-2` sí tiene que poder.

```
PASO M4 | esperado: rechaza el duplicado en la misma cocina y acepta en la otra | Ventas → Productos
```

---

### Task 2: Venta en el mostrador

**Files:** ninguno.

- [ ] **Step 1: V1, una cocina, dos unidades**

Vender 2 × `VTA-SIMPLE` con **Vender sin imprimir**. Total 2.000. El ticket aparece en Mostrador y en Mis Pedidos. `VTA-INS-A` pasa de 24 a 20 y se anota de qué almacén salió cada unidad. Queda un movimiento `venta` de −4 con la referencia del ticket, y una comanda en `VTA-COCINA-1`.

```
PASO V1 | esperado: total 2.000, A 24 → 20, un movimiento venta de −4, una comanda | Mostrador, stock y base
```

- [ ] **Step 2: V2, dos cocinas en un ticket**

Vender 1 × `VTA-SIMPLE` + 1 × `VTA-OTRA-COCINA`. Total 1.900. A pasa a 18 y B a 2. La cocina es la estación de retiro, así que el ticket tiene que decir por dónde se retira cada producto, y tienen que quedar **dos** filas en `ordenes_cocina`, una por estación, cada una con su ítem.

```
PASO V2 | esperado: total 1.900, A 18, B 2, dos estaciones en el ticket y dos filas | Mostrador y base
```

- [ ] **Step 3: V3, promo**

Vender 1 × `VTA-COMBO`. Total 1.800. La promo expande el bundle: A baja 4 y queda en 14. No tiene que haber movimiento del producto de venta, solo de los insumos.

```
PASO V3 | esperado: total 1.800, A 14, movimientos solo de insumos | Mostrador y base
```

- [ ] **Step 4: V4, receta fraccionada**

Vender 2 × `VTA-KILO`. Total 3.000. `VTA-INS-KG` pasa de 10 a 9,5 y el movimiento es de −0,5 con tres decimales.

```
PASO V4 | esperado: total 3.000, KG 9,5, movimiento −0,500 | Mostrador y base
```

- [ ] **Step 5: V5, dos insumos en una receta**

Vender 1 × `VTA-MIXTO`. Total 700. A pasa a 13 y C a 19. Dos movimientos, uno por insumo.

```
PASO V5 | esperado: total 700, A 13, C 19, dos movimientos | Mostrador y base
```

- [ ] **Step 6: V6, imprimir el ticket**

Vender 1 × `VTA-SIMPLE` con **Imprimir Ticket**. Sin impresora configurada tiene que avisar y **la venta no puede quedar a medias**: o se registró y solo falló la impresión, o no se registró. Se anota cuál de las dos pasó, el total del ticket impreso y si la cantidad y el total del render coinciden con el ticket guardado.

```
PASO V6 | esperado: la venta y la impresión no se contradicen | Mostrador y base
```

- [ ] **Step 7: El total del navegador no manda**

Repetir una venta interceptando el pedido para enviar un total distinto del que corresponde. El servidor recalcula: el ticket guardado tiene que tener el total correcto, no el enviado.

```
PASO V7 | esperado: el total guardado es el del servidor | base
```

---

### Task 3: Ventas que no tienen que pasar

**Files:** ninguno.

- [ ] **Step 1: Producto sin receta**

Intentar vender `VTA-SIN-RECETA`. Tiene que avisar y no registrar nada. Ni ticket, ni movimiento, ni comanda.

```
PASO N1 | esperado: rechaza y no escribe nada | Mostrador y base
```

- [ ] **Step 2: Más que el disponible**

Intentar vender más `VTA-SIMPLE` que el disponible. La pantalla tiene que frenar la carga o avisar al confirmar. El stock no se mueve.

```
PASO N2 | esperado: avisa y el stock no cambia | Mostrador y base
```

- [ ] **Step 3: Dos ventas simultáneas del último stock**

Con `VTA-INS-B` en 2, disparar dos ventas de 2 × `VTA-OTRA-COCINA` a la vez por API. Una tiene que responder 201 y la otra 409 con el faltante. B queda en 0, nunca negativo, y queda un solo ticket.

```
PASO N3 | esperado: una 201 y una 409, B en 0, un ticket | API y base
```

- [ ] **Step 4: Cantidad decimal en consumo**

En Registrar Consumo, escribir una cantidad con coma. Anotar si la pantalla la acepta y qué responde el servidor, que exige entero. Si la pantalla la acepta y el servidor la rechaza, es un hallazgo.

```
PASO N4 | esperado: o la pantalla no la deja escribir, o avisa con el mensaje del servidor | Registrar Consumo
```

---

### Task 4: Consumo interno

**Files:** ninguno.

- [ ] **Step 1: C1, consumo con nota**

Registrar el consumo de 1 × `VTA-SIMPLE` con una nota. El ticket queda con total 0 y `origen = consumo`. A pasa de 13 a 11. El movimiento es de tipo `consumo`, no `venta`.

```
PASO C1 | esperado: total 0, origen consumo, A 11, movimiento consumo | Registrar Consumo y base
```

- [ ] **Step 2: El consumo no es ingreso**

En Reportes → Métricas y en Inicio, ese consumo no tiene que sumar a las ventas ni al ticket promedio. Se anota si aparece en alguna lista aparte.

```
PASO C2 | esperado: no suma a ingresos | Inicio y Reportes
```

---

### Task 5: Devoluciones y anulación

**Files:** ninguno.

- [ ] **Step 1: D1, la venta que se va a devolver**

Vender 3 × `VTA-SIMPLE`. Total 3.000. A pasa de 11 a 5.

- [ ] **Step 2: D2, devolución parcial de 1**

Devolver 1 unidad. Queda un ticket nuevo con estado devuelto, un movimiento `devolucion` de +2, y A vuelve a 7. El tope de devolución de ese producto pasa a 2: intentar devolver 3 tiene que estar frenado.

```
PASO D1 | esperado: A 7, movimiento devolucion +2, tope 2 | Devoluciones y base
```

- [ ] **Step 3: D3, anular la misma venta**

Anular el ticket de D1. **Lo correcto es que A quede en 11**, porque de los 6 descontados ya se devolvieron 2. Si queda en 13, la anulación devolvió de más y es el fallo grave del ciclo.

```
PASO D2 | esperado: A 11 y no 13 | Mis Pedidos y base
```

- [ ] **Step 4: Devolución total de otra venta**

Sobre la venta V1, hacer una devolución total. Estado devuelto, movimientos que devuelven exactamente lo descontado, y el ticket sale de los ingresos.

```
PASO D3 | esperado: devuelve exactamente lo vendido | Mis Pedidos y base
```

- [ ] **Step 5: La comanda de un ticket anulado**

Después de anular y de devolver, mirar `ordenes_cocina` de esos tickets. Como la cocina es solo la estación de retiro, que sigan en `pending` no rompe ninguna cuenta: se anota como dato que queda colgado, no como fallo.

```
PASO D4 | esperado: anotar en qué estado queda la comanda | base
```

---

### Task 6: Editar un ticket emitido

**Files:** ninguno.

- [ ] **Step 1: Cambiar la cantidad de una línea**

Tomar un ticket emitido de 2 × `VTA-SIMPLE` y pasarlo a 3. El total tiene que quedar en 3.000, y en movimientos tiene que haber un `venta_anulada` por lo viejo y un `venta` por lo nuevo. El neto del stock es −2 de A.

```
PASO E1 | esperado: total 3.000, venta_anulada y venta, neto −2 | Mis Pedidos y base
```

- [ ] **Step 2: La comanda después de editar**

La comanda se rehace: las líneas viejas no pueden quedar duplicadas con las nuevas.

```
PASO E2 | esperado: una comanda por cocina con las líneas nuevas | base
```

- [ ] **Step 3: Editar hasta quedar sin stock**

Intentar subir la cantidad más allá del stock disponible. Tiene que fallar sin dejar el ticket a medio editar: ni el total ni los movimientos cambian.

```
PASO E3 | esperado: falla y no cambia nada | Mis Pedidos y base
```

---

### Task 7: Cuentas de equipo

**Files:** ninguno.

- [ ] **Step 1: Abrir la cuenta y cargar productos**

Abrir la cuenta `VTA-EQUIPO`, agregar 2 × `VTA-SIMPLE` y 1 × `VTA-KILO`. El total acumulado es 3.500. **El stock todavía no tiene que haber bajado**, porque no se cobró.

```
PASO T1 | esperado: total acumulado 3.500 y stock sin cambios | Mesas y base
```

- [ ] **Step 2: Recargar con la cuenta abierta**

Recargar la página. La cuenta y sus productos tienen que seguir ahí, con el mismo total.

```
PASO T2 | esperado: la cuenta sobrevive la recarga | Mesas
```

- [ ] **Step 3: Agregar más de lo que hay**

Agregar una cantidad mayor al disponible. Anotar si la pantalla lo permite. Al cobrar tiene que fallar por falta de stock y **la cuenta tiene que quedar abierta con sus productos**, no perderse.

```
PASO T3 | esperado: si no valida al agregar, al menos no pierde la cuenta al fallar | Mesas
```

- [ ] **Step 4: Cobrar y cerrar**

Dejar la cuenta en 2 × `VTA-SIMPLE` + 1 × `VTA-KILO` y cobrar. Queda un solo ticket con total 3.500, con las estaciones de retiro de sus productos, y el stock baja en ese momento: A −4 y KG −0,25.

```
PASO T4 | esperado: un ticket de 3.500 con sus estaciones, A −4, KG −0,25 | Mesas y base
```

- [ ] **Step 5: Qué queda de la cuenta cerrada**

Mirar `cuentas_equipo`: si la fila se borra en lugar de quedar cerrada, el estado `cerrada` del enum no se usa nunca y no hay historial de la cuenta. Se anota.

```
PASO T5 | esperado: la cuenta cobrada deja rastro | base
```

- [ ] **Step 6: Dos cuentas sobre la última unidad**

Abrir una segunda cuenta y cargar en las dos el mismo producto hasta pasar el stock disponible entre ambas. Mientras están abiertas no hay stock reservado, así que las dos van a parecer cobrables. Cobrar la primera y después la segunda: la segunda tiene que fallar con el faltante y quedar abierta.

```
PASO T6 | esperado: la segunda falla al cobrar y no se pierde | Mesas y base
```

---

### Task 8: Altas y bajas del catálogo

Esta es la tarea que más importa: es donde la lógica de bajas se sospecha mal planteada.

**Files:** ninguno.

- [ ] **Step 1: Baja de cocina con productos**

Intentar borrar `VTA-COCINA-2`, que tiene un producto. Tiene que avisar y no borrar.

```
PASO B1 | esperado: rechaza con mensaje claro | Ventas → Productos → Cocinas
```

- [ ] **Step 2: Baja de cocina con comandas**

Intentar borrar `VTA-COCINA-1`, que ya tiene comandas. Tiene que avisar que se desactive en lugar de borrar.

```
PASO B2 | esperado: rechaza y ofrece desactivar | Ventas → Productos → Cocinas
```

- [ ] **Step 3: Cocina inactiva y venta**

Desactivar `VTA-COCINA-2` y vender su producto. Lo que importa es si el ticket sigue diciendo por dónde se retira. Anotar además si la venta pasa y si se crea la fila de comanda: hoy la venta pasa y la fila no se crea, en silencio.

```
PASO B3 | esperado: el ticket dice la estación de retiro igual | Mostrador y base
```

- [ ] **Step 4: Baja de un producto de venta ya vendido**

Borrar `VTA-MIXTO` desde Ventas → Productos. Sale del mostrador, pero los tickets viejos conservan su nombre y su precio, y las métricas del pasado no cambian.

```
PASO B4 | esperado: sale del mostrador y el historial no cambia | Ventas, Reportes y base
```

- [ ] **Step 5: Baja de un producto que es componente de una promo**

Borrar `VTA-SIMPLE`, que es el componente de `VTA-COMBO`. Anotar si avisa. Después intentar vender `VTA-COMBO`: si la promo se puede seguir vendiendo con un componente dado de baja, es un fallo.

```
PASO B5 | esperado: avisa, o la promo deja de venderse | Ventas → Productos y Mostrador
```

- [ ] **Step 6: Baja de un insumo de inventario usado en una receta**

Borrar `VTA-INS-C` desde el módulo de stock. `items_receta` tiene borrado en cascada y `DELETE /stock/products/:id` no comprueba nada, así que se espera que la línea de receta de `VTA-MIXTO` desaparezca sola.

Anotar tres cosas: si la pantalla avisó, qué quedó de la receta, y si `VTA-MIXTO` se puede seguir vendiendo. Si se vende y descuenta solo `VTA-INS-A`, el producto pasó a consumir menos stock del que consume de verdad. Ese es el fallo que el dueño sospechaba.

```sql
SELECT pv.name, p.code AS insumo, ir.quantity
FROM items_receta ir
JOIN productos_venta pv ON pv.id = ir."salesProductId"
LEFT JOIN productos p ON p.id = ir."stockProductId"
WHERE pv.name LIKE 'VTA-%';
```

```
PASO B6 | esperado: no deja borrar un insumo en uso, o al menos avisa y el producto de venta deja de venderse | stock, Ventas y base
```

- [ ] **Step 7: Baja de una categoría de venta con productos**

Intentar borrar `VTA-CAT`. La relación es `Restrict`: tiene que avisar y no borrar.

```
PASO B7 | esperado: rechaza | Configuración → Ventas
```

- [ ] **Step 8: Impresoras**

Crear una impresora `VTA-IMP` con IP y puerto, marcarla por defecto, probar la conexión (va a fallar, no hay hardware, y el mensaje tiene que ser claro), editarla y borrarla. Anotar qué pasa con el ticket por defecto cuando se borra la que estaba marcada.

```
PASO B8 | esperado: alta, edición y baja sin dejar una impresora por defecto fantasma | Configuración → Impresoras
```

- [ ] **Step 9: Cambiar una receta después de vender**

Cambiar la receta de `VTA-SIMPLE` de 2 a 3 unidades de `VTA-INS-A`. Las ventas viejas no tienen que cambiar de descuento. Después devolver una unidad de una venta vieja y ver con qué cantidad devuelve: si devuelve 3 en lugar de 2, la devolución usa la receta de hoy y no la del momento de la venta.

```
PASO B9 | esperado: la devolución de una venta vieja usa la receta de esa venta | Devoluciones y base
```

- [ ] **Step 10: Cambiar un producto de simple a promo**

Pasar un producto simple a promo y volver. La receta y el bundle no pueden quedar los dos cargados a la vez.

```
PASO B10 | esperado: queda solo receta o solo bundle | Ventas → Productos y base
```

---

### Task 9: Reportes y métricas

**Files:** ninguno.

- [ ] **Step 1: Insertar los tickets con fecha anterior**

Insertar por SQL los cuatro tickets de la tabla del spec (2026-09-23 por 2.000, 2026-09-06 por 3.000, 2026-07-28 por 5.000 y 2026-03-09 por 9.000) más el del borde de día (2026-09-25T02:30:00Z por 1.111). No escriben movimientos ni tocan niveles.

- [ ] **Step 2: Los cuatro rangos**

Con `V` el total de las ventas emitidas del recorrido y `N` su cantidad: 7 días da `V + 2.000` y `N + 1`; 30 días `V + 5.000` y `N + 2`; 3 meses `V + 10.000` y `N + 3`; el año `V + 19.000` y `N + 4`. El ticket promedio es el total del rango dividido por sus tickets, redondeado a peso entero.

```
PASO R1 | esperado: los cuatro totales y los cuatro promedios | Reportes → Métricas
```

- [ ] **Step 3: El borde de día**

El ticket de las 23:30 del 24 en Argentina no tiene que sumar a las ventas de hoy. Si suma, se anota como hallazgo de consistencia: las métricas usan la zona del navegador y el módulo de stock usa la de Argentina.

```
PASO R2 | esperado: no suma a hoy | Reportes → Métricas e Inicio
```

- [ ] **Step 4: Inicio contra Métricas**

Las ventas del día, la cantidad de tickets y el producto más vendido del Inicio tienen que coincidir con lo que muestra Métricas para hoy.

```
PASO R3 | esperado: los mismos números en las dos pantallas | Inicio y Reportes
```

- [ ] **Step 5: Reporte por cocina**

Con el rango de fechas del recorrido, las unidades por cocina tienen que coincidir con lo vendido: la promo suma a la cocina de su producto y el ticket de dos cocinas reparte. Exportar a Excel y comprobar que el archivo trae las mismas filas.

```
PASO R4 | esperado: unidades por cocina y export coincidentes | Reportes → Por cocina
```

- [ ] **Step 6: Historial**

Mirar el Historial sin recargar después de una venta nueva: si no aparece hasta recargar, es un hallazgo. Abrir el detalle de un ticket editado y de uno anulado y comprobar que el historial de cambios los muestra.

```
PASO R5 | esperado: la venta nueva aparece y los cambios están | Reportes → Historial
```

- [ ] **Step 7: Recargar todo**

Recargar el navegador y volver a leer Inicio, Métricas, Historial y Mis Pedidos. Ningún número puede cambiar.

```
PASO R6 | esperado: los mismos números después de recargar | todas
```

---

### Task 10: Permisos

**Files:** ninguno.

- [ ] **Step 1: Vendedor**

Entrar con `vta-vendedor`. Tiene que ver solo Mostrador, Mis Pedidos, Devoluciones y Registrar Consumo. No puede entrar a Inicio, Productos, Mesas ni Reportes, ni escribiendo la URL con `?tab=`. En Configuración ve solo Impresoras.

```
PASO P1 | esperado: cuatro pestañas y solo Impresoras | Ventas y Configuración
```

- [ ] **Step 2: El vendedor ve solo sus tickets**

Vender con el vendedor y comprobar que Mis Pedidos muestra su venta y no las del admin. `GET /sales/tickets` con su token tiene que devolver solo las suyas.

```
PASO P2 | esperado: solo sus tickets, en pantalla y en la API | Mis Pedidos y API
```

- [ ] **Step 3: Gerente de ventas**

Entrar con `vta-gerente`. Ve las siete pestañas y la configuración de ventas completa. No puede entrar al módulo de stock.

```
PASO P3 | esperado: ventas completo y stock negado | Ventas, Configuración y stock
```

- [ ] **Step 4: Anular con cada rol**

Anular un ticket con el gerente tiene que poder. Con el vendedor, no.

```
PASO P4 | esperado: el gerente anula, el vendedor no | Mis Pedidos y API
```

---

### Task 11: La diferencia entre lo tickeado y lo contado

El dueño vende un solo día por semana y cuenta el stock el lunes siguiente. El stock del sistema sale de las ventas tickeadas; el stock real sale de las entradas de pedidos y del control. Esta tarea no arregla nada: mide dónde termina hoy esa diferencia, para que el ciclo que la separe arranque con evidencia.

**Files:** ninguno.

- [ ] **Step 1: Cerrar el sábado**

Anotar, para `VTA-INS-A`: el nivel del sistema, lo que entró por pedidos, lo que descontaron las ventas del recorrido y lo que descontó el consumo interno. Esos cuatro números tienen que explicar el nivel exacto.

```
PASO S1 | esperado: entradas − ventas − consumos ± ajustes = nivel | base
```

- [ ] **Step 2: Contar menos de lo esperado**

Cargar un control de stock de `VTA-INS-A` contando **2 unidades menos** que lo que muestra el sistema. Eso simula lo que se fue sin ticket: mal tickeado, rotura o robo.

```
PASO S2 | esperado: el nivel queda en lo contado | Controlar Stock y base
```

- [ ] **Step 3: Dónde quedó esa diferencia**

Buscar el movimiento que escribió el control y anotar su tipo y su referencia.

```sql
SELECT m."createdAt", m.type, m.reference, d.name AS deposito, m.quantity
FROM movimientos_stock m
JOIN productos p ON p.id = m."productId"
LEFT JOIN depositos d ON d.id = m."warehouseId"
WHERE p.code = 'VTA-INS-A'
ORDER BY m."createdAt";
```

Se espera `ajuste_manual` con referencia `control-stock`, es decir el mismo tipo que una corrección a mano y que las dos patas de un pasaje. Anotar si se puede separar la fuga de una corrección sin depender de ese texto.

```
PASO S3 | esperado: la diferencia se distingue de un ajuste a mano por el modelo, no por un texto | base
```

- [ ] **Step 4: Qué pantalla la muestra**

Recorrer el inicio de stock, Reportes y el detalle del producto buscando la diferencia del control. Si ninguna pantalla la muestra como tal, es un hallazgo.

```
PASO S4 | esperado: alguna pantalla muestra la diferencia del control | Inicio, Reportes y ficha
```

- [ ] **Step 5: La diferencia por almacén**

`entradas_conteo` guarda esperado y contado sumados por producto. Comprobar si la diferencia por almacén se puede reconstruir, y de dónde.

```sql
SELECT s.date, p.code, e.expected, e.counted, e.expected - e.counted AS diferencia
FROM entradas_conteo e
JOIN sesiones_conteo s ON s.id = e."sessionId"
JOIN productos p ON p.id = e."productId"
WHERE p.code LIKE 'VTA-%' ORDER BY s.date;
```

```
PASO S5 | esperado: se sabe en qué almacén faltó | base
```

- [ ] **Step 6: Qué le hace al pedido sugerido**

En la pantalla de pedidos, mirar el sugerido de `VTA-INS-A` antes y después del control. El consumo del control incluye la fuga, así que el sugerido tiene que subir. Eso es lo correcto: se repone contra lo que realmente se fue.

```
PASO S6 | esperado: el sugerido sube porque el consumo del control incluye la fuga | Pedidos
```

- [ ] **Step 7: Antigüedad del dato**

Anotar si alguna pantalla dice cuándo fue el último control de cada producto. Un stock contado hace dos días y uno contado hace tres meses se muestran igual.

```
PASO S7 | esperado: se ve la fecha del último control | ficha y Controlar Stock
```

---

### Task 12: Integridad de la base

**Files:** ninguno.

- [ ] **Step 1: Nivel contra movimientos**

Para cada insumo `VTA-`, el nivel tiene que ser igual a la suma de sus movimientos.

```sql
SELECT p.code, d.name AS deposito,
       COALESCE(n.quantity, 0) AS nivel,
       COALESCE(m.suma, 0) AS movimientos,
       COALESCE(n.quantity, 0) - COALESCE(m.suma, 0) AS delta
FROM productos p
JOIN niveles_stock n ON n."productId" = p.id
JOIN depositos d ON d.id = n."warehouseId"
LEFT JOIN (
  SELECT "productId", "warehouseId", SUM(quantity) AS suma
  FROM movimientos_stock GROUP BY "productId", "warehouseId"
) m ON m."productId" = n."productId" AND m."warehouseId" = n."warehouseId"
WHERE p.code LIKE 'VTA-%'
ORDER BY p.code, d.name;
```

- [ ] **Step 2: Total del ticket contra sus líneas**

```sql
SELECT t.number, t.status, t.origen, t.total,
       COALESCE(SUM(i."unitPrice" * i.quantity), 0) AS suma_lineas
FROM tickets_venta t
LEFT JOIN items_ticket_venta i ON i."ticketId" = t.id
GROUP BY t.id, t.number, t.status, t.origen, t.total
HAVING t.total <> COALESCE(SUM(i."unitPrice" * i.quantity), 0);
```

Tiene que devolver cero filas, salvo los tickets insertados a mano, que se anotan aparte.

- [ ] **Step 3: Movimientos por tipo**

```sql
SELECT m.type, COUNT(*), SUM(m.quantity)
FROM movimientos_stock m
JOIN productos p ON p.id = m."productId"
WHERE p.code LIKE 'VTA-%'
GROUP BY m.type ORDER BY m.type;
```

Lo devuelto por `devolucion` más `venta_anulada` no puede superar lo salido por `venta`.

- [ ] **Step 4: Comandas**

```sql
SELECT t.number, c.name AS cocina, o.status, COUNT(ki.id) AS items
FROM ordenes_cocina o
JOIN tickets_venta t ON t.id = o."ticketId"
JOIN cocinas c ON c.id = o."kitchenId"
LEFT JOIN items_orden_cocina ki ON ki."kitchenOrderId" = o.id
GROUP BY t.number, c.name, o.status ORDER BY t.number;
```

- [ ] **Step 5: Contador y negativos**

El contador tiene que ser mayor o igual al número de ticket más alto, y no puede haber ningún nivel negativo.

```sql
SELECT (SELECT valor FROM contadores_ticket WHERE id = 'default') AS contador,
       (SELECT MAX(number) FROM tickets_venta) AS ultimo_ticket,
       (SELECT COUNT(*) FROM niveles_stock WHERE quantity < 0) AS negativos;
```

- [ ] **Step 6: Restaurar la configuración**

Volver cada control de Configuración → Ventas al valor anotado en la Task 0 y comprobar en `configuraciones` que quedó como estaba.

---

### Task 13: Informe

**Files:**
- Create: `docs/superpowers/reports/2026-09-25-test-modulo-ventas-informe.md`

- [ ] **Step 1: Escribir el informe**

Una línea por paso con el formato de arriba. Después, tres secciones: los fallos ordenados por consecuencia, los hallazgos, y los datos `VTA-` que quedaron en la base con su estado final.

- [ ] **Step 2: Lo que entra al ciclo 2**

Lista de arreglos propuestos, cada uno con el paso que lo encontró. Los tres ya decididos van primero: la anulación después de una devolución parcial, sacar el interruptor de protección de concurrencia, y los tests que faltan.

- [ ] **Step 3: Las preguntas de producto**

Lo que no se puede decidir leyendo código: el momento de la comanda en una cuenta de equipo, y qué tiene que pasar cuando se borra un insumo que está en una receta.

- [ ] **Step 4: La base del ciclo 3**

Lo que la Task 11 haya mostrado sobre la diferencia entre lo tickeado y lo contado, con los números reales: qué tipo de movimiento la guarda hoy, qué pantalla la muestra, si se sabe el almacén y si se conoce la fecha del último control. Ese es el punto de partida del ciclo que separe el stock real del stock del sistema.

- [ ] **Step 4: Commit**

```bash
git commit -am "docs(ventas): informe del recorrido del modulo de ventas"
```
