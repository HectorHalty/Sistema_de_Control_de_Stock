# Stock real contra stock del sistema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el dueño vea, en cada control de stock, cuánto se fue sin registrar en cada producto, y que el pedido sugerido se calcule con el consumo real del ciclo en lugar de con esa diferencia.

**Architecture:** un ciclo va de un control al siguiente. El servidor suma los movimientos del ciclo por producto y por tipo en una consulta, porque el cliente solo tiene las últimas 500 filas del libro y eso son unas tres semanas. La aritmética vive en un módulo puro nuevo, `stock-cycles.ts`, que toma esas sumas y devuelve una fila por producto. De ahí comen la pantalla de diferencias y el pedido sugerido, así no hay dos fórmulas que puedan separarse. La diferencia del control y el pasaje dejan de ser `ajuste_manual` y pasan a tener tipo propio, que es lo que permite sumar cada columna sin depender de un texto libre.

**Tech Stack:** React 18 + Vite + Vitest en `apps/web-admin`. NestJS 11 + Prisma en `apps/api`. Postgres 16.

**Origen:** `docs/superpowers/specs/2026-09-25-stock-real-vs-sistema-design.md`.

**Ciclo:** 3. El 1 es el recorrido del módulo de ventas y el 2 sus arreglos. Este ciclo no depende de los otros dos.

## Global Constraints

- El consumo real de un ciclo es `contado del control anterior + entradas de pedidos del ciclo − contado del control de cierre`. Las entradas que cuentan son solo las que quedaron entre los dos controles.
- La diferencia es `esperado − contado`, con `esperado = contado anterior + entradas + devoluciones y anulaciones − ventas − consumos − roturas`.
- Las dos formas de escribir el consumo real tienen que dar lo mismo. Si no dan, falta un movimiento y la fila se marca.
- Un ciclo entra al promedio del pedido solo si tuvo al menos una venta. Los ciclos sin ventas se ven igual en la pantalla, como control de recepción.
- Un ciclo hereda el `dateType` de su control de cierre. El pedido sigue separando `regular` de `after`.
- Todo en unidades. No se agrega costo ni valuación.
- Sin tolerancias, sin umbrales y sin alertas por diferencia. Se ven todos los productos contados.
- Por producto. No se agrega el desglose por almacén, aunque el dato exista en los movimientos.
- Agregar un valor a un enum de Postgres y usarlo no puede pasar en la misma transacción: van dos migraciones.
- La suma de los movimientos del ciclo la hace el servidor. `GET /stock/movements` devuelve como máximo 500 filas y el admin pide exactamente 500: alcanza para unas tres semanas de ventas, no para el histórico.
- Commits al estilo del repo, uno por tarea.
- El ciclo deja su propio test de regresión: un spec en la suite de Playwright que ya corre en CI, con la cantidad exacta del oráculo. Un arreglo sin guardia vuelve a romperse.

## Oráculo

Tres ciclos de un producto con unidad de pedido 24. El segundo es un control de verificación después de recibir un pedido.

| Ciclo | Anterior | Entradas | Ventas | Consumo | Rotura | Esperado | Contado | Diferencia | Consumo real | ¿Venta? |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 100 | 0 | 50 | 0 | 0 | 50 | 46 | 4 | 54 | sí |
| B | 46 | 60 | 0 | 0 | 0 | 106 | 104 | 2 | 2 | no |
| C | 104 | 0 | 60 | 2 | 1 | 41 | 38 | 3 | 66 | sí |

Pedido sugerido con la ventana que abarca los tres ciclos, stock actual 38:

- Promedio del consumo real de los ciclos con venta: `(54 + 66) / 2 = 60`.
- Crudo: `60 − 38 = 22`.
- Con redondeo al pack de 24: **24**.

Con la fórmula de hoy, que promedia la diferencia, daría `(4 + 3) / 2 = 3,5`, y `3,5 − 38` es negativo, así que sugeriría **0**. Ese contraste es el test que fija el cambio.

El ciclo B no entra al promedio aunque tenga consumo real 2: no tuvo ventas, así que su diferencia es de recepción.

## File structure

| File | Responsibility |
|------|----------------|
| Modify: `apps/api/prisma/schema.prisma` | `diferencia_conteo` y `pasaje` en `TipoMovimientoStock` |
| Create: `apps/api/prisma/migrations/*_tipos_movimiento_stock/migration.sql` | Agrega los dos valores al enum |
| Create: `apps/api/prisma/migrations/*_retipear_movimientos/migration.sql` | Re-tipea el histórico por referencia |
| Modify: `apps/api/src/stock/stock.service.ts` | El control escribe `diferencia_conteo`, el pasaje escribe `pasaje`, el ajuste guarda el motivo |
| Modify: `apps/api/src/stock/dto.ts` | Motivo del ajuste y tipo del control |
| Modify: `apps/api/src/stock/stock.controller.ts` | `GET /stock/cycles/:sessionId` |
| Modify: `apps/api/src/stock/stock-movements.service.ts` | Suma por producto y tipo entre dos fechas |
| Create: `apps/web-admin/src/features/inventory/stock-cycles.ts` | La aritmética del ciclo, pura |
| Create: `apps/web-admin/src/features/inventory/stock-cycles.test.ts` | El oráculo de arriba |
| Modify: `apps/web-admin/src/features/inventory/order-suggestions.ts` | Promedia el consumo real de los ciclos con venta |
| Modify: `apps/web-admin/src/features/inventory/order-suggestions.test.ts` | Reescribe el oráculo viejo |
| Modify: `apps/web-admin/src/features/inventory/pages/OrdersPage.tsx` | Pasa ciclos en lugar de sesiones |
| Modify: `apps/web-admin/src/features/inventory/pages/ReportsPage.tsx` | Pestaña Diferencias |
| Modify: `apps/web-admin/src/features/inventory/pages/ConsumptionPage.tsx` | Tipo de control y fecha del último |
| Modify: `apps/web-admin/src/features/inventory/types.ts` | Tipos del ciclo y del motivo |
| Modify: `apps/web-admin/src/app/api/client.ts` | Motivo del ajuste en el cliente |

---

### Task 1: Tipos de movimiento propios

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: dos migraciones
- Modify: `apps/api/src/stock/stock.service.ts`

**Interfaces:**
- Consumes: `applyStockCount` y `transferStock`, que hoy escriben `ajuste_manual`.
- Produces: la diferencia de un control es `diferencia_conteo` y cada pata de un pasaje es `pasaje`. Un ajuste a mano sigue siendo `ajuste_manual`.

- [ ] **Step 1: Enum**

Agregar `diferencia_conteo` y `pasaje` a `TipoMovimientoStock`. Una migración que solo agrega los dos valores.

- [ ] **Step 2: Re-tipear el histórico**

Migración aparte, porque Postgres no deja usar un valor de enum recién agregado en la misma transacción:

```sql
UPDATE "movimientos_stock" SET type = 'diferencia_conteo'
WHERE type = 'ajuste_manual' AND reference = 'control-stock';

UPDATE "movimientos_stock" SET type = 'pasaje'
WHERE type = 'ajuste_manual' AND (reference LIKE 'Pasaje a %' OR reference LIKE 'Pasaje desde %');
```

- [ ] **Step 3: Servicio**

`applyStockCount` escribe `diferencia_conteo`. `transferStock` escribe `pasaje` en las dos patas. `adjustStock` no cambia de tipo.

- [ ] **Step 4: Filtro de movimientos**

`GET /stock/movements` acepta los dos tipos nuevos en su filtro, y la pantalla de reportes los muestra con nombre en castellano.

- [ ] **Step 5: Tests y build**

`npm --prefix apps/api test` y `npm --prefix apps/api run build`. El test del pasaje ya existente pasa a esperar `pasaje`.

- [ ] **Step 6: Commit**

```bash
git commit -am "fix(stock): separar la diferencia del control y el pasaje del ajuste a mano"
```

---

### Task 2: Motivo del ajuste a mano

**Files:**
- Modify: `apps/api/src/stock/dto.ts`
- Modify: `apps/api/src/stock/stock.service.ts`
- Modify: `apps/web-admin/src/app/api/client.ts`
- Modify: `apps/web-admin/src/features/inventory/pages/ProductsPage.tsx` y la pantalla de ajuste

**Interfaces:**
- Consumes: `AdjustStockDto`, que hoy tiene una referencia de texto libre.
- Produces: un motivo de una lista cerrada: `rotura`, `vencido`, `correccion`, `entrada_directa`. La referencia sigue existiendo para el detalle.

- [ ] **Step 1: DTO y servicio**

Motivo opcional en el DTO para no romper lo que ya llama al endpoint, y obligatorio desde la pantalla. El motivo va al movimiento: si hoy no hay columna, se guarda como prefijo de la referencia con un formato fijo, y el módulo de ciclos lo lee de ahí. Si se agrega columna, es una migración más y el módulo no cambia.

- [ ] **Step 2: Pantalla**

Un combo de motivos en el ajuste de stock. Los regalos no están en la lista: van por Registrar Consumo.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(stock): pedir el motivo de un ajuste a mano"
```

---

### Task 3: Control de verificación

**Files:**
- Modify: `apps/web-admin/src/features/inventory/pages/ConsumptionPage.tsx`
- Modify: `apps/web-admin/src/features/inventory/types.ts`

**Interfaces:**
- Consumes: `sesiones_conteo.dateType`, que es un `String` y hoy vale `regular` o `after`. No hace falta migración.
- Produces: un tercer valor, `verificacion`, para el control que se hace después de recibir un pedido.

- [ ] **Step 1: Selector**

Un tercer tipo de control en la pantalla, con un texto que explique para qué es: comprobar una recepción, no cerrar un día de venta.

- [ ] **Step 2: Que no ensucie el pedido**

El pedido sugerido ya filtra por `dateType`, así que un control de verificación no entra ni a `regular` ni a `after`. Se agrega un test de eso.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(stock): marcar el control que verifica una recepcion"
```

---

### Task 4: La cuenta del ciclo

El servidor suma, el navegador calcula. El cliente no puede hacer las dos cosas: pide 500 movimientos y eso son unas tres semanas de ventas, así que los ciclos viejos saldrían mal y sin avisar.

**Files:**
- Modify: `apps/api/src/stock/stock-movements.service.ts`
- Modify: `apps/api/src/stock/stock.controller.ts`
- Create: `apps/web-admin/src/features/inventory/stock-cycles.ts`
- Create: `apps/web-admin/src/features/inventory/stock-cycles.test.ts`
- Modify: `apps/web-admin/src/app/api/client.ts`

**Interfaces:**
- Consumes: los controles (`sesiones_conteo` con sus entradas) y los movimientos ya tipados por la Task 1.
- Produces: `GET /stock/cycles/:sessionId` devuelve el ciclo que cierra ese control: las dos fechas, el `dateType`, si tuvo ventas, y una fila por producto con lo contado en los dos extremos y las sumas por tipo de movimiento. `buildStockCycleRows(...)`, puro, agrega `esperado`, `diferencia`, `consumoReal` y `cierra`.

- [ ] **Step 1: La suma en el servidor**

Para el control elegido, buscar el control inmediatamente anterior por día calendario. Sumar los movimientos que caen entre los dos con un `groupBy` de producto y tipo, no trayendo fila por fila. `diferencia_conteo` queda afuera de las sumas: es lo que ese control corrigió y ya está dentro de lo contado. El `ajuste_manual` se separa entre rotura y el resto según el motivo.

El primer control de la historia no cierra ningún ciclo: no hay contado anterior. Se responde vacío con ese motivo.

- [ ] **Step 2: Si tuvo ventas**

El endpoint informa si en la ventana del ciclo hubo al menos un movimiento de tipo `venta`. Esa bandera es la que decide si el ciclo entra al promedio del pedido.

- [ ] **Step 3: La aritmética, pura**

`esperado = contadoAnterior + entradas + devoluciones − ventas − consumos − roturas`, `diferencia = esperado − contado`, `consumoReal = contadoAnterior + entradas − contado`.

`cierra` es verdadero cuando `consumoReal` es igual a `ventas + consumos + roturas + diferencia`, con tres decimales. Cuando no cierra, la fila se marca: falta un movimiento y eso se muestra, no se esconde.

- [ ] **Step 4: Tests**

El oráculo de los tres ciclos de este plan, sobre las sumas que devuelve el endpoint. Más: un producto que no se contó en uno de los dos controles queda informado aparte y no en cero; un ciclo sin ventas tiene la bandera en falso; un pasaje entre almacenes no mueve ninguna columna, porque sus dos patas suman cero en el total del producto.

- [ ] **Step 5: Test de base**

Un test de integración contra Postgres que cargue más de 500 movimientos en un ciclo y compruebe que el endpoint devuelve las sumas completas. Ese es el caso que ningún recorrido a mano encuentra.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(stock): sumar el ciclo entre dos controles en el servidor"
```

---

### Task 5: El pedido sugerido usa el consumo real

**Files:**
- Modify: `apps/web-admin/src/features/inventory/order-suggestions.ts`
- Modify: `apps/web-admin/src/features/inventory/order-suggestions.test.ts`
- Modify: `apps/web-admin/src/features/inventory/pages/OrdersPage.tsx`

**Interfaces:**
- Consumes: los ciclos de la Task 4 en lugar de las sesiones crudas.
- Produces: `promedio del consumo real de los ciclos con venta de la ventana − stock actual`, con el mismo redondeo al pack y la misma regla de que 0 o menos sugiere 0.

- [ ] **Step 1: Cambiar el número que se promedia**

La ventana sigue filtrando por la fecha del control que cierra el ciclo, y el `dateType` sigue separando `regular` de `after`. Cambian dos cosas: se promedia `consumoReal` en lugar de `expected − counted`, y los ciclos sin ventas no entran.

- [ ] **Step 2: Reescribir el oráculo de los tests**

El test viejo fija la fórmula vieja: se reemplaza por el oráculo de este plan, incluido el caso que contrasta 24 contra el 0 que daría la fórmula anterior.

- [ ] **Step 3: La columna de la pantalla**

Hoy la columna dice "Consumo Prom. Diario" y muestra el promedio por control, que no es diario. Pasa a decir lo que muestra: el consumo promedio por ciclo, con la cantidad de ciclos que entraron.

- [ ] **Step 4: Texto de ayuda**

Explicar en una línea de dónde sale el número: del consumo real entre controles, no de las ventas tickeadas.

- [ ] **Step 5: Tests y build**

`npm --prefix apps/web-admin test` y el build.

- [ ] **Step 6: Commit**

```bash
git commit -am "fix(stock): pedir segun el consumo real del ciclo, no segun la diferencia"
```

---

### Task 6: Extender la pantalla que ya existe

**Hallazgo durante la ejecución:** la pantalla de diferencias ya está construida. Reportes tiene la pestaña **Control de Stock**, que usa `buildReconciliation` (`apps/web-admin/src/features/inventory/reconciliation.ts`) y muestra stock esperado, contado, faltante, sobrante, cuántos productos tienen diferencia, la tabla "Esperado vs. Contado" con inicial, entradas, ventas, consumos y ajustes, un filtro de solo diferencias y export a Excel. No hay que crear nada nuevo: hay que corregirla y completarla.

**Lo que está mal hoy:** esa pantalla lee `stockMovements` del estado del admin, que se hidrata con `stockApi.movements.list({ limit: 500 })`. La diferencia que muestra es correcta, porque sale de `expected` y `counted` de la sesión. Pero **el desglose de qué la explica se corta a las últimas 500 filas del libro**: en un período viejo las columnas de ventas, consumos y entradas quedan incompletas o en cero sin ningún aviso, y el `inicial` derivado de la identidad queda mal cuando no hay control anterior.

**Files:**
- Modify: `apps/web-admin/src/features/inventory/pages/ReportsPage.tsx`
- Modify: `apps/web-admin/src/features/inventory/reconciliation.ts`
- Modify: `apps/web-admin/src/app/components/xlsxExport.ts`

**Interfaces:**
- Consumes: el endpoint del ciclo de la Task 4, en lugar de los movimientos truncados del estado local.
- Produces: la misma pestaña, con el desglose completo, el consumo real y la rotura.

- [ ] **Step 1: Que no lea un libro truncado**

La pestaña pasa a pedir el ciclo al endpoint de la Task 4. `buildReconciliation` deja de recorrer los movimientos del estado y pasa a recibir las sumas ya agregadas. Si el ciclo elegido no se puede resolver, la pantalla lo dice en vez de mostrar ceros.

- [ ] **Step 2: Las columnas que faltan**

Agregar rotura como columna propia, el consumo real, y la diferencia como porcentaje del consumo real. Actualizar el export a Excel con las mismas columnas.

- [ ] **Step 3: Qué ciclo se está viendo**

Arriba: de qué control a qué control, cuántos días y si tuvo ventas. Un ciclo sin ventas se titula como control de recepción, para no leer una diferencia de remito como una fuga de mostrador.

- [ ] **Step 4: Todos los productos**

El filtro de solo diferencias se queda, apagado por defecto: el dueño quiere ver todos los productos. Los que no se contaron en uno de los dos controles se listan aparte en vez de mostrarse en cero.

- [ ] **Step 5: Commit**

```bash
git commit -am "fix(stock): que la conciliacion no lea un libro de movimientos truncado"
```

---

### Task 7: Antigüedad del dato

**Files:**
- Modify: `apps/web-admin/src/features/inventory/pages/ProductsPage.tsx`
- Modify: `apps/web-admin/src/features/inventory/pages/ConsumptionPage.tsx`

- [ ] **Step 1: Fecha del último control**

Al lado del stock de cada producto, en la ficha y en Controlar Stock, la fecha del último control y cuántos días pasaron.

- [ ] **Step 2: Commit**

```bash
git commit -am "feat(stock): mostrar cuando fue el ultimo control de cada producto"
```

---

### Task 8: Verificación en vivo

**Files:** ninguno, salvo que un paso muestre un número distinto del oráculo.

- [ ] **Step 1: Reproducir los tres ciclos**

Con la API y la pantalla, armar los tres ciclos del oráculo sobre un producto de prueba: control, venta, control, recepción, control de verificación, venta con consumo y rotura, control.

- [ ] **Step 2: La pantalla contra el oráculo**

Las tres filas de diferencias tienen que dar 4, 2 y 3, y el ciclo B tiene que aparecer como control de recepción.

- [ ] **Step 3: El pedido**

Con stock 38 y pack 24, el sugerido tiene que ser 24, y el consumo promedio mostrado 60 sobre 2 ciclos.

- [ ] **Step 4: El histórico re-tipeado**

Los controles anteriores a la migración también tienen que aparecer con su diferencia, porque el re-tipeo alcanzó a sus movimientos.

- [ ] **Step 5: Un ciclo con muchos movimientos**

Cargar un ciclo con más de 500 movimientos y comprobar en la pantalla que las sumas siguen completas. Con la cuenta en el navegador, este caso daba mal en silencio.

- [ ] **Step 6: Dejar el oráculo clavado en el e2e**

Un spec nuevo en la suite de Playwright que ya corre en CI (`e2e/tests/admin/`): cargar un control, leer la diferencia del ciclo y comprobar que el pedido sugerido de ese producto es el número exacto que manda el oráculo, no solo que sea mayor a cero. Los specs de hoy afirman dirección (`toBeLessThan`); este afirma cantidad.

Sin este paso, el ciclo deja la cuenta corregida y sin guardia: el próximo cambio la puede volver a romper y nadie se enteraría hasta el sábado.

- [ ] **Step 6: Informe**

`docs/superpowers/reports/2026-09-25-stock-real-vs-sistema-informe.md` con lo implementado, los números vistos y lo que quedó afuera.

- [ ] **Step 7: Commit**

```bash
git commit -am "docs(stock): informe del stock real contra el stock del sistema"
```
