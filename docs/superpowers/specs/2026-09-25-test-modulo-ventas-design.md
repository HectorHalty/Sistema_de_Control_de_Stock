# Test en vivo del módulo de ventas — Diseño

**Fecha:** 2026-09-25
**Proyecto:** monorepo Sistema de Gestión LCH (`apps/web-admin`, `apps/api`, Postgres local `lch_stock`)
**Estado:** decidido en chat con el dueño del sistema. Pendiente de aprobación de este archivo.
**Siguiente:** revisión. El recorrido no se corre hasta que se apruebe.

## Problema

El módulo de ventas nunca se recorrió completo. Hay que comprobar que el dinero, el stock y las comandas de cocina cierran entre pantallas, en la base y en el tiempo, y que el alta y la baja de cocinas, recetas, productos e impresoras no dejan el inventario en un estado que no se pueda explicar.

La sospecha del dueño es que la lógica de las bajas no está bien planteada. La lectura del código la confirma antes de tocar la pantalla: `items_receta.stockProduct` tiene `onDelete: Cascade` y `DELETE /stock/products/:id` borra sin ninguna comprobación, así que borrar un insumo saca la línea de receta en silencio.

## Dos ciclos

| Ciclo | Qué hace | Entregable |
|---|---|---|
| **1 (este)** | Recorrido en vivo e informe. No cambia código. | `docs/superpowers/reports/2026-09-25-test-modulo-ventas-informe.md` |
| **2 (después)** | Plan de arreglos escrito a partir del informe. | Plan nuevo, commits y tests |

Ya hay tres decisiones tomadas para el ciclo 2, así que no se discuten en el informe, solo se confirman:

1. Anular un ticket después de una devolución parcial no puede devolver stock de más.
2. El interruptor de protección de concurrencia se saca de la pantalla: el servidor ya bloquea siempre.
3. El ciclo 2 deja tests en el repo: unitarios de lo que se toque, más el test de base del checkout por HTTP, que hoy no existe.

## Alcance

**Entra:** las siete pestañas de `#/ventas` (Inicio, Mostrador, Mis Pedidos, Devoluciones, Registrar Consumo, Productos con cocinas y recetas, Reportes con sus tres secciones), la configuración de ventas en `#/configuracion` incluidas las impresoras, los permisos de Vendedor y de Gerente de ventas, y el efecto de cada venta sobre el stock y sobre `ordenes_cocina`.

**Fuera:** el módulo Online y la web pública de la cantina. La pantalla de cocina (KDS) vive en Online, así que las comandas se verifican en la base y por lo que muestra ventas, no recorriendo esa pantalla. Fútbol, APK y el módulo de stock, ya recorrido. Imprimir contra una impresora real: no hay hardware en esta máquina, así que se prueba el alta, la baja y el render del ticket, no el envío a una IP.

## Decisiones

| Tema | Decisión |
|---|---|
| Forma | Recorrido en vivo del admin. Informe con una línea por paso. |
| Dónde | `http://127.0.0.1:5173` con `admin` / `admin123`. API en `http://127.0.0.1:3001`. Postgres local. |
| Datos | Prefijo `VTA-`. No se borran al terminar. Se documentan en el informe. |
| Código | No se modifica en este ciclo. |
| Usuarios | Se crean un Vendedor y un Gerente de ventas de prueba para los permisos. |
| Fechas | Se insertan tickets con fecha anterior en la base para que los rangos de métricas midan algo. Esas filas no escriben movimientos de stock. |
| Configuración | Se anota cada control antes de tocarlo y se restaura al final. |

## Oráculo del dinero

No hay descuentos, ni IVA, ni impuestos, ni caja. El total de un ticket es siempre la suma de precio unitario por cantidad. El servidor recalcula el total y no confía en el del navegador: el número de la pantalla y el de la base tienen que coincidir igual.

La cantidad de un producto de venta es un entero mayor a 0 (`@IsInt @Min(1)`). Lo fraccionado vive solo en las recetas.

El número de ticket sale de un contador global en `contadores_ticket`, no por día y sin prefijo. Cada venta, cada devolución parcial y cada consumo lo suben en 1. El oráculo no fija un número absoluto: se anota el contador antes de empezar y cada operación tiene que sumar exactamente 1.

`Ticket promedio` es `round(total del rango / cantidad de tickets del rango)`, redondeado a peso entero.

Los consumos internos tienen total 0 y `origen = consumo`. No suman a ningún ingreso. Los tickets anulados y devueltos tampoco.

## Oráculo del stock

Una venta descuenta según la receta. Un producto simple consume `cantidad de receta × unidades vendidas`. Una promo expande su bundle y multiplica. Un producto simple sin receta no se puede vender: el servidor lo rechaza.

El reparto entre almacenes es codicioso por id de almacén: toma del primero lo que pueda y sigue con el siguiente. Si la suma de todos los almacenes no alcanza, la venta falla completa con 409 y no escribe nada.

Cada operación escribe su tipo de movimiento, y la cantidad de una salida es negativa:

| Operación | Tipo de movimiento | Signo |
|---|---|---|
| Venta | `venta` | negativo |
| Consumo interno | `consumo` | negativo |
| Devolución total o parcial | `devolucion` | positivo |
| Anulación | `venta_anulada` | positivo |
| Edición de ítems | `venta_anulada` por lo viejo y `venta` por lo nuevo | positivo y negativo |

La referencia del movimiento es el UUID del ticket, no el número visible.

**La regla que cierra todo:** para cada producto e insumo del recorrido, el nivel de `niveles_stock` tiene que ser igual a la suma de `movimientos_stock.quantity`, y esa suma tiene que explicarse por lo que realmente se vendió. Devolver 1 de un ticket de 3 y después anular ese ticket tiene que devolver 3 en total, no 4.

## Datos del recorrido

### Insumos de inventario

| Código | Unidad | Stock inicial | Para qué |
|---|---|---|---|
| `VTA-INS-A` | unidades | 5 en Depósito Principal y 7 en Quincho Bar | Reparto entre dos almacenes |
| `VTA-INS-B` | unidades | 2 en Depósito Principal | Dos ventas simultáneas del último stock |
| `VTA-INS-KG` | kg | 10 en Depósito Principal | Receta fraccionada |
| `VTA-INS-C` | unidades | 20 en Depósito Principal | Se borra a propósito, para ver la cascada |

### Catálogo de ventas

Dos cocinas, `VTA-COCINA-1` y `VTA-COCINA-2`, y una categoría de venta `VTA-CAT`.

| Producto | Precio | Tipo | Receta o bundle | Cocina |
|---|---|---|---|---|
| `VTA-SIMPLE` | 1.000 | simple | 2 × `VTA-INS-A` | 1 |
| `VTA-COMBO` | 1.800 | promo | 2 × `VTA-SIMPLE` | 1 |
| `VTA-KILO` | 1.500 | simple | 0,25 kg de `VTA-INS-KG` | 1 |
| `VTA-MIXTO` | 700 | simple | 1 × `VTA-INS-A` y 1 × `VTA-INS-C` | 1 |
| `VTA-SIN-RECETA` | 500 | simple | ninguna | 1 |
| `VTA-OTRA-COCINA` | 900 | simple | 1 × `VTA-INS-B` | 2 |

Disponible para vender, con el stock inicial: `VTA-SIMPLE` 6 unidades (12 de A entre los dos almacenes, receta 2), `VTA-COMBO` 3, `VTA-KILO` 40, `VTA-MIXTO` 12, `VTA-OTRA-COCINA` 2, `VTA-SIN-RECETA` 0.

### Tickets con fecha anterior

Se insertan en `tickets_venta` con `origen = pos`, `status = emitido` y una línea de `VTA-SIMPLE`. No escriben movimientos ni tocan niveles: existen solo para los rangos de métricas. Hoy es 2026-09-25.

| Fecha | Total | Entra en |
|---|---|---|
| 2026-09-23 | 2.000 | 7 días, 30, 90 y año |
| 2026-09-06 | 3.000 | 30, 90 y año |
| 2026-07-28 | 5.000 | 90 y año |
| 2026-03-09 | 9.000 | año |

Las ventanas incluyen hoy y van hasta `hoy − (n − 1)` días: 7 días arranca el 2026-09-19, 30 días el 2026-08-27, 90 días el 2026-06-28 y el año el 2025-09-26. Cada rango suma exactamente un ticket viejo más que el anterior.

Si `V` es el total de las ventas hechas en el recorrido y `N` su cantidad:

| Rango | Total esperado | Tickets |
|---|---|---|
| 7 días | `V + 2.000` | `N + 1` |
| 30 días | `V + 5.000` | `N + 2` |
| 3 meses | `V + 10.000` | `N + 3` |
| Año | `V + 19.000` | `N + 4` |

### Ticket del borde de día

Se inserta además un ticket de 1.111 con fecha `2026-09-25T02:30:00Z`, que en Argentina es el 2026-09-24 a las 23:30.

**Oráculo:** el día de una venta es el día de `America/Argentina/Buenos_Aires`, igual que el día de alerta del stock. Ese ticket es del 24 y no tiene que sumar a las ventas de hoy. Las métricas de hoy usan la zona del navegador, no la de Argentina. Si la pantalla lo cuenta como hoy, se anota como hallazgo de consistencia entre módulos, no como una suma equivocada.

## Lo que ya se sabe del código

Estos son los candidatos que el recorrido va a confirmar o descartar. Están acá para que el informe no los presente como una sorpresa.

1. **Anular después de devolver parcial devuelve de más.** `netRestoreQuantitiesAfterPartialReturns` existe en `apps/api/src/sales/sales-integrity.ts` y no se llama desde ningún lado. El ticket original conserva la asignación completa.
2. **Borrar un insumo de inventario borra la línea de receta en cascada.** `DELETE /stock/products/:id` hace un `delete` directo. Si la receta tenía dos insumos, el producto de venta sigue vendible y deja de descontar el que se borró.
3. **Anular o devolver no toca la comanda.** La orden de cocina queda en `pending`.
4. **Si la cocina está inactiva, la venta pasa y no se crea la comanda**, en silencio.
5. **El Historial no muestra la venta recién hecha** hasta recargar: usa una consulta propia, aparte de la lista en memoria.
6. **El interruptor de protección de concurrencia no se lee en ningún lado.** Ya decidido: se saca en el ciclo 2.
7. **Una cuenta de equipo no valida stock al agregar productos** y no reserva nada hasta cobrar.
8. **Una promo puede tener un componente dado de baja.** La baja de un producto de venta es lógica (`active: false`) y el bundle sigue apuntándolo.
9. **La cantidad decimal en consumo** la escribe la pantalla y la rechaza el servidor, que exige entero.

## Cuentas de equipo

Según el dueño: se venden productos igual que en el mostrador, y al final del día se paga el total y se cierra la cuenta.

**Oráculo:** al cobrar queda un solo ticket con el total acumulado, el stock baja en ese momento, y las comandas de las cocinas involucradas se crean. Si el stock no alcanza al cobrar, la venta falla y la cuenta queda abierta con sus productos.

Queda una pregunta de producto que el informe tiene que dejar planteada, no resolver: si el equipo consume durante el día, la cocina tendría que recibir la comanda cuando se agrega el producto, no cuando se cobra. Hoy la comanda sale recién al cobrar. La decisión es del dueño y va al ciclo 2.

## Permisos

| Rol | Tiene que ver | No tiene que ver |
|---|---|---|
| SuperAdmin | Todo ventas y todo stock | — |
| Gerente de ventas | Las siete pestañas de ventas y la configuración de ventas completa | El módulo de stock |
| Vendedor | Mostrador, Mis Pedidos, Devoluciones y Registrar Consumo. En configuración, solo Impresoras | Inicio, Productos, Mesas, Reportes, stock |

Además, `GET /sales/tickets` con un Vendedor tiene que devolver solo los tickets de ese vendedor.

## Integridad de la base

Al final del recorrido, sobre los productos `VTA-`:

- El nivel de cada insumo es igual a la suma de sus movimientos.
- Ningún nivel quedó negativo. La restricción `niveles_stock_quantity_no_negativa` no se violó.
- Cada ticket tiene `total` igual a la suma de sus líneas.
- El contador de `contadores_ticket` es mayor o igual al número de ticket más alto.
- Cada venta con dos cocinas dejó dos filas en `ordenes_cocina`, con sus ítems.
- Las devoluciones y anulaciones dejaron los tipos de movimiento que les corresponden.
- Lo devuelto por una devolución parcial más su anulación no supera lo vendido.

## Qué es un fallo

- Un total distinto entre el mostrador, el ticket, el historial, las métricas y la base.
- Un descuento de stock distinto del que manda la receta.
- Un stock que queda negativo, o una venta que pasa sin stock.
- Una devolución o una anulación que devuelve más de lo que se vendió.
- Una baja que deja una receta, una promo o una comanda apuntando a algo que ya no existe, sin avisar.
- Un permiso que no se respeta.
- Un dato que cambia al recargar.

Un número que la pantalla muestra distinto de lo que dice su etiqueta es un hallazgo, aunque la cuenta interna sea correcta.
