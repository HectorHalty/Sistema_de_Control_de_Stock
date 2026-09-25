# Stock real contra stock del sistema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el dueño vea, en cada control de stock, cuánto se fue sin registrar en cada producto, y que el pedido sugerido se calcule con el consumo real del ciclo en lugar de con esa diferencia.

**Architecture:** un ciclo va de un control al siguiente. La cuenta vive en un módulo puro nuevo, `stock-cycles.ts`, que recibe los controles y los movimientos y devuelve una fila por producto y por ciclo. De ahí comen la pantalla de diferencias y el pedido sugerido, así no hay dos fórmulas que puedan separarse. La diferencia del control y el pasaje dejan de ser `ajuste_manual` y pasan a tener tipo propio, que es lo que permite calcular cada columna sin depender de un texto libre.

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
- Commits al estilo del repo, uno por tarea.

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
| Create: `apps/web-admin/src/features/inventory/stock-cycles.ts` | La cuenta del ciclo, pura |
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

### Task 4: El módulo de ciclos

**Files:**
- Create: `apps/web-admin/src/features/inventory/stock-cycles.ts`
- Create: `apps/web-admin/src/features/inventory/stock-cycles.test.ts`

**Interfaces:**
- Consumes: los controles (`StockCountSession`) y los movimientos de stock ya tipados.
- Produces: `buildStockCycles(...)` devuelve, por ciclo y por producto: `contadoAnterior`, `entradas`, `ventas`, `consumos`, `roturas`, `devoluciones`, `esperado`, `contado`, `diferencia`, `consumoReal`, `dateType`, `tuvoVentas` y `cierra` (si las dos formas del consumo real coinciden).

- [ ] **Step 1: Armar los ciclos**

Ordenar los controles por día calendario. Cada par consecutivo es un ciclo. Los movimientos entran por su fecha, después del control que abre y hasta el que cierra. El primer control de la historia no abre ciclo: no hay contado anterior.

- [ ] **Step 2: Las columnas**

Sumar los movimientos del ciclo por tipo. `entrada` y `devolucion` suman; `venta`, `consumo` y `venta_anulada` van con su signo; `ajuste_manual` se separa entre rotura y el resto según el motivo; `diferencia_conteo` **no entra**, porque es justamente lo que el control corrigió y ya está dentro de `contado`.

- [ ] **Step 3: La comprobación propia**

`cierra` es verdadero cuando `contadoAnterior + entradas − contado` es igual a `ventas + consumos + roturas + diferencia`, con tres decimales. La pantalla muestra la fila marcada cuando no cierra, en vez de esconder el descuadre.

- [ ] **Step 4: Tests**

El oráculo de los tres ciclos de este plan. Más: un producto que no se contó en un control queda fuera del ciclo y se informa; un ciclo sin ventas tiene `tuvoVentas` falso; un pasaje entre almacenes no cambia ninguna columna, porque sus dos patas suman cero en el total del producto.

- [ ] **Step 5: Commit**

```bash
git commit -am "test(admin): ciclo de stock entre dos controles"
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

### Task 6: Pantalla de Diferencias

**Files:**
- Modify: `apps/web-admin/src/features/inventory/pages/ReportsPage.tsx`

**Interfaces:**
- Consumes: `buildStockCycles`.
- Produces: una pestaña con el ciclo elegido y una fila por producto contado.

- [ ] **Step 1: Selector de ciclo**

Por defecto el último. Arriba: de qué control a qué control, cuántos días, el tipo del control de cierre y si tuvo ventas. Un ciclo sin ventas se titula como control de recepción.

- [ ] **Step 2: La tabla**

Columnas: producto, contado anterior, entradas, ventas, consumo, rotura, esperado, contado, diferencia, y la diferencia como porcentaje del consumo real. Todos los productos contados, sin filtro. Ordenable por diferencia.

- [ ] **Step 3: El total del ciclo**

Abajo: unidades que salieron, cuántas explican las ventas y los consumos, y cuántas no. Y los productos que no se contaron en ese control, listados aparte en vez de mostrados en cero.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(stock): pantalla de diferencias entre lo tickeado y lo contado"
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

- [ ] **Step 5: Informe**

`docs/superpowers/reports/2026-09-25-stock-real-vs-sistema-informe.md` con lo implementado, los números vistos y lo que quedó afuera.

- [ ] **Step 6: Commit**

```bash
git commit -am "docs(stock): informe del stock real contra el stock del sistema"
```
