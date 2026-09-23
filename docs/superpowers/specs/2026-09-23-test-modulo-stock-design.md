# Test en vivo del módulo de stock — Diseño

**Fecha:** 2026-09-23
**Proyecto:** monorepo Sistema de Gestión LCH (`apps/web-admin`, `apps/api`, Postgres local)
**Estado:** aprobado en chat, pendiente de revisión del spec
**Siguiente:** revisión de este archivo. No se ejecuta el recorrido hasta que se apruebe.

## Problema

Hay que recorrer el módulo de stock ya levantado y comprobar que los números
coinciden en todas las pantallas, en el tiempo y en la base. El pedido
automático tiene una regla de negocio distinta de la que calcula la pantalla
hoy: sale del control de stock, no de las ventas.

Este ciclo produce un informe. No cambia código.

## Fuera de alcance

- Corregir el generador de pedidos, las alertas o las configuraciones.
- Dejar una suite automática en el repo.
- Borrar los registros `TEST-` al final.
- Web pública, fútbol, online, impresora y APK.

## Decisiones

| Tema | Decisión |
|---|---|
| Forma | Recorrido en vivo del admin. Informe en el chat. |
| Dónde | http://localhost:5173 con `admin` / `admin123`. API en http://localhost:3001. Postgres local `lch_stock`. |
| Datos | Registros con prefijo `TEST-`. El producto del pedido usa una categoría que ya exista. |
| Código | No se modifica. |
| Configuración | Se anota el valor de cada control antes de tocarlo y se restaura al final. |
| Informe | Por cada paso: resultado, cantidad esperada, cantidad vista y en qué pantalla. |

## Enfoques considerados

1. **Recorrido en vivo e informe.** Elegido. El sistema ya está levantado y lo que hay que ver es si el mismo número aparece en cada pantalla.
2. **Suite automática.** Queda para otro ciclo, si el informe cierra la regla.
3. **Arreglar el generador y después probar.** Fuera de este ciclo.

## Oráculo del pedido

La fuente es el control de stock. Consumido de un control = stock que había − lo que se contó. Si se contó más de lo que había, el consumido es negativo y baja el promedio.

Un pedido regular usa solo controles regulares. Un pedido after usa solo controles after.

- **Fecha puntual:** consumido de ese control − stock actual.
- **Semana, mes o 3 meses:** promedio por control de esa ventana (suma de consumidos ÷ cantidad de controles de ese tipo) − stock actual.
- Ventana semana: últimos 7 días calendario, incluido hoy.
- Ventana mes: últimos 30 días calendario, incluido hoy.
- Ventana 3 meses: últimos 90 días calendario, incluido hoy.
- Si el resultado es 0 o menos, lo sugerido es 0.
- Si la unidad de pedido no está o es menor o igual a 1, no se redondea a pack.
- Con **Unidad de pedido** prendida, el resultado positivo se redondea hacia arriba al múltiplo de la unidad de pedido: `ceil(cantidad / unidad) * unidad`.
- Con **Unidad de pedido** apagada, queda el resultado sin redondear.

El stock actual es la suma de todos los almacenes del producto en el momento de calcular.

### Sesiones de historia

La pantalla de control fecha cada sesión con el día de hoy y no deja elegir otra fecha. Para poder separar semana, mes, 3 meses y una fecha puntual, las sesiones del ejemplo se insertan en `sesiones_conteo` / `entradas_conteo` con estas fechas. Esas filas no mueven `niveles_stock` ni escriben `movimientos_stock`.

Hoy es 2026-09-23. Stock actual al calcular: **10**. Unidad de pedido: **24**.

El control del paso 6 queda guardado hoy, tipo regular, consumido 10 (había 70 entre los dos almacenes y se contaron 60). Entra en la semana, el mes y los 3 meses. Una sesión cuenta por su día calendario. Las filas insertadas usan `date` = `YYYY-MM-DD`. El control hecho en pantalla cuenta como 2026-09-23 aunque el texto guardado en `date` lleve hora o formato local.

| Fecha | Tipo | Consumido | Origen |
|---|---|---|---|
| 2026-09-23 | regular | 10 | Paso 6, en pantalla |
| 2026-09-21 | regular | 30 | Fila insertada |
| 2026-09-22 | regular | 20 | Fila insertada |
| 2026-09-01 | regular | 50 | Fila insertada |
| 2026-07-23 | regular | 10 | Fila insertada |
| 2026-09-22 | after | 40 | Fila insertada |

Cuentas con el interruptor de unidad de pedido prendido:

| Selección | Cuenta | Sugerido |
|---|---|---|
| Fecha 2026-09-21, regular | 30 − 10 = 20 | 24 |
| Semana, regular | (30 + 20 + 10) / 3 − 10 = 10 | 24 |
| Mes, regular | (30 + 20 + 10 + 50) / 4 − 10 = 17,5 | 24 |
| 3 meses, regular | (30 + 20 + 10 + 50 + 10) / 5 − 10 = 14 | 24 |
| Fecha 2026-09-22, after | 40 − 10 = 30 | 48 |
| Semana, after | 40 − 10 = 30 | 48 |

El control after del 2026-09-22 no entra en ninguna cuenta regular. El control regular del 2026-09-01 no entra en la semana. El del 2026-07-23 entra solo en los 3 meses.

Con el interruptor apagado, los sugeridos son 20, 10, 17,5, 14, 30 y 30.

Después de esas lecturas, y con el interruptor apagado, se agrega un control regular del 2026-09-20 con consumido −10. La semana pasa a (30 + 20 + 10 − 10) / 4 − 10 = 2,5. Tiene que bajar respecto de 10. La fecha 2026-09-21 sigue en 20, porque ese día tiene un solo control.

## Recorrido

Antes de crear nada, anotar en el inicio de stock: stock total, cantidad de productos, cantidad de almacenes y pedidos pendientes. El stock total del sistema incluye datos que ya estaban. Se compara el delta, no el número absoluto.

### 1. Maestros

Crear almacén `TEST-A`, almacén `TEST-B`, proveedor `TEST` y producto `TEST` con unidad de pedido 24 y stock 0 en `TEST-A`. Asignar el producto al proveedor. Tienen que figurar en sus listas con esos datos.

### 2. Alta

Sumar 100 en `TEST-A`. Ficha, almacén, control y reportes muestran 100. Queda el movimiento de +100. El stock total del inicio sube 100.

### 3. Baja

Restar 30. Los cuatro lugares muestran 70. Movimiento de −30. El stock total queda 70 por encima del valor anotado al principio.

### 4. Pasaje

Pasar 20 de `TEST-A` a `TEST-B`. `TEST-A` queda en 50, `TEST-B` en 20 y el total sigue en 70. El stock total del inicio no se mueve. Si no hay una acción de pasaje y hay que hacerlo con dos ajustes, eso se anota y la conservación del total igual tiene que cumplirse.

### 5. Faltante

Intentar sacar 999 de `TEST-B`. El stock no queda negativo, la pantalla avisa y `TEST-B` sigue en 20. No se agrega un movimiento de esa operación.

### 6. Control

Control regular. En `TEST-A` había 50 y se cuenta 40. `TEST-B` se deja en 20. En la línea del almacén se ve 50 → 40. El consumido del producto es 10, porque entre los dos almacenes había 70 y se contaron 60. El stock pasa a 40 y 20. Recargar la página: siguen 40 y 20. El stock total queda 60 por encima del valor inicial.

### 7. Reportes

El reporte del producto muestra la alta de 100, la baja de 30, el pasaje de 20 y el control, con las mismas cantidades que la ficha.

### 8. Dashboard en cada paso

Justo después de cada alta de maestro, alta, baja, pasaje, control y pedido:

- El delta del stock total es el delta del producto `TEST`.
- Al crear el producto, el contador de productos sube 1.
- Al crear los dos almacenes, el contador de almacenes sube 2.
- Al guardar el pedido, Pedidos Pendientes sube 1.
- La actividad reciente muestra esa acción en el momento. El inicio de stock y el dashboard general muestran el mismo stock y los mismos pedidos pendientes.

### 9. Pedido automático

Dejar el stock total de `TEST` en 10 con un ajuste, sin crear otro control. Insertar las cinco sesiones de la tabla. Calcular en la pantalla de pedidos, con el proveedor `TEST`, las seis selecciones de la tabla, primero con unidad de pedido prendida y después apagada. Recargar y volver a calcular la fecha 2026-09-21: sigue en 24 con el interruptor prendido. Agregar el control regular del 2026-09-20 con consumido −10 y comprobar que la semana, con el interruptor apagado, pasa de 10 a 2,5.

### 10. Alertas, notificaciones y configuración

Producto aparte `TEST-ALERTA`, unidad de pedido 1. El producto `TEST` no tiene ventas: no tiene que aparecer como stock bajo.

La campana general de notificaciones tiene que estar prendida durante esta parte. Si estaba apagada, se prende y se restaura al final. Cada cambio de Configuración, pestaña Stock, se recarga y se lee de nuevo. En la tabla `configuracion` tienen que quedar las claves `stock.lowStockNotifications`, `stock.alertDay`, `stock.autoAlerts` y `stock.packRounding` con el valor elegido.

El orden importa, porque una venta cambia la regla que se está mirando.

1. Dejar `TEST-ALERTA` en 8, sin ventas. **Alertas automáticas** prendidas y **Notificaciones de stock bajo** apagadas: la campana avisa, porque el texto dice que avisa al bajar de 20. Apagar alertas automáticas: ese aviso de 20 no sale.
2. Con las dos apagadas, no hay "Stock bajo" de este producto.
3. Subir el stock a 208 y vender 200 en el mostrador, con un producto de venta de receta 1 a 1. El stock vuelve a 8 y queda un movimiento `venta` de 200. El promedio semanal es el techo del promedio diario de esa venta en el último mes, multiplicado por 7.
4. **Notificaciones de stock bajo** prendidas y **Alertas automáticas** apagadas. Como 8 es menor que el promedio semanal y no hay pedido pendiente, el aviso sale. El mismo producto y la cantidad 8 aparecen en la campana (título "Stock bajo", texto `TEST-ALERTA: 8 uds restantes`, marcada como error porque quedan menos de 10), en la tarjeta y la lista del inicio de stock, en el dashboard general y en Reportes, pestaña Alertas, con stock 8, pedidos pendientes 0 y ese promedio semanal.
5. Apagar **Notificaciones de stock bajo**: el aviso por promedio semanal no sale.
6. **Día de alerta.** Hoy es miércoles. Con las notificaciones de stock bajo prendidas, en Jueves hoy no avisa y en Miércoles sí. El valor guardado es `Miercoles` o `Jueves`, sin acento, como el combo.
7. Un pedido pendiente de `TEST-ALERTA` que cubra el faltante (cantidad pedida mayor o igual al promedio semanal − 8) lo saca de la campana, del inicio, del dashboard general y de Reportes.

La campana muestra como máximo 5 alertas de stock, las de error antes que las de aviso. Reportes muestra la lista completa. El dashboard general muestra como máximo 4. Si `TEST-ALERTA` no entra en ese cupo, se anota y no se toma como fallo de la lista de reportes.

No hay un campo para cargar "el mínimo configurado" que menciona el texto de Notificaciones de stock bajo. Se busca esa pantalla. Si no existe, va al informe. La unidad de pedido quedó cubierta en el paso 9.

Al terminar, los cuatro controles y la campana general vuelven al valor anotado al empezar.

## Integridad de la base

Dos lecturas sobre el producto `TEST`.

**Después del paso 6**

- Una fila de producto, unidad de pedido 24, un nivel por almacén.
- `TEST-A` = 40, `TEST-B` = 20. Ninguna cantidad negativa.
- La suma de `movimientos_stock.quantity` de cada almacén es igual al nivel: 40 y 20.
- La sesión de hoy, para el producto, guarda esperado 70 y contado 60. La línea de `TEST-A` en la pantalla es 50 → 40 y la de `TEST-B` queda en 20.
- El producto está vinculado al proveedor `TEST`.
- No hay movimientos de ese producto sin fila de producto.

**Al final del recorrido**

- El nivel de `TEST` suma 10, y la suma de sus movimientos también.
- Están las sesiones de la tabla, con su tipo y su consumido (esperado − contado), más el control de consumido −10.
- El pedido de `TEST` está Pendiente, con el proveedor `TEST` y las cantidades que confirmó la pantalla.
- `TEST-ALERTA` queda en 8. La suma de sus movimientos cierra en 8 e incluye la venta de 200.
- Ningún nivel del recorrido quedó negativo.
- Las cuatro claves de configuración, después de restaurar, coinciden con los valores iniciales.

El alta inicial en 0 no escribe un movimiento. A partir del primer ajuste, cada cambio del recorrido pasa por un ajuste o por un control, así que la suma de movimientos cierra con el nivel.

## Qué es un fallo

- Un número distinto entre ficha, almacén, control, reportes, inicio o base.
- Un pedido sugerido distinto de la tabla.
- Stock negativo, o una baja de más que sí descuente.
- Una configuración que se guarda y no cambia el aviso o el pedido como dice su texto.
- Un dato que cambia al recargar.

Si no existe la acción de pasaje, es un hallazgo. El total conservado sigue siendo obligatorio.
