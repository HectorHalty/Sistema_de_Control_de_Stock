# Informe del recorrido de stock — 2026-09-23

Recorrido en vivo del admin en `http://localhost:5173` (`admin` / `admin123`). No se modificó el generador de pedidos, las alertas ni las configuraciones. Los registros `TEST-` quedaron en la base local.

## Cuaderno

| Nombre | Valor |
|---|---|
| BASE_STOCK | 3812 |
| BASE_PRODUCTS | 15 |
| BASE_WAREHOUSES | 4 |
| BASE_PENDING | 0 |
| BASE_NOTIF | prendido |
| BASE_LOW | prendido |
| BASE_DAY | Jueves |
| BASE_AUTO | prendido |
| BASE_PACK | prendido |
| CATEGORY_ID | `ebc762e8-5a2b-4153-8514-11f63f7cac38` (Bebidas) |
| WA | `388accce-4839-4db9-9b35-1f2b1449506f` (TEST-A) |
| WB | `d6c1bc50-b180-4815-9c3b-2485953306ca` (TEST-B) |
| PRODUCT_ID | `93a45fc6-09f9-4542-afaf-768794b05457` |
| Producto | TEST, código `BEB-004`, unidad de pedido 24 |
| SUPPLIER_ID | `9a7517fd-2877-476e-9c03-a123c464dd31` (TEST) |
| TEST-ALERTA | nombre TEST-ALERTA, código `BEB-005`, unidad de pedido 1 |
| WEEKLY | 46 (31 días, venta de 200) |
| cover | 38 |
| Pedido de cobertura | PED-006, Pendiente, cantidad 38, proveedor TEST |

El formulario asigna el código y no deja escribir `TEST-PROD` ni `TEST-ALERTA`. Al cerrar, las cuatro claves quedaron como al empezar: `stock.lowStockNotifications` true, `stock.alertDay` `Jueves`, `stock.autoAlerts` true, `stock.packRounding` true. Notificaciones del Sistema quedó prendida.

La venta de 200 se publicó por `/sales/checkout` autenticado, ticket #1003, no por el botón del mostrador. El stock de TEST-ALERTA volvió a 8 y el movimiento es `venta` −200.

## Líneas

```text
PASO BASE | OK | stock=3812 productos=15 almacenes=4 pendientes=0 | inicio /stock
PASO M1 | OK | esperado: TEST-A y TEST-B | visto: TEST-A / TEST-B | almacenes
PASO M2 | OK | esperado: TEST / BEB-004 / unidad 24 / stock 0 | visto: TEST / BEB-004 / Pack x24 / 0 uds, solo formulario | productos
PASO M3 | OK | esperado: proveedor TEST con BEB-004 | visto: 1 fila TEST + BEB-004 | proveedores
PASO M4 | OK | esperado: productos 16, almacenes 6, stock 3812 | visto: 16 / 6 / 3812 | /stock
PASO M4-actividad | FALLO | esperado: altas visibles | visto: Sin actividad reciente | /stock
PASO M4-home | FALLO | esperado: stock 3812 en inicio y en /stock | visto: /stock 3812; / sin número de stock | / y /stock
PASO M2-code | OK | esperado: código UI = código DB | visto: BEB-004 = BEB-004 | productos y Postgres
PASO A1 | OK | esperado: 100 en ficha, almacén, control y reportes | visto: 100 en los cuatro | cuatro pantallas
PASO A2 | OK | esperado: stock total 3912 | visto: 3912 | /stock
PASO A3 | OK | esperado: nivel 100 y movimiento +100 | visto: TEST-A 100; ajuste_manual +100 | Postgres
PASO B1 | OK | esperado: 70 y movimiento -30 | visto: 70 y -30 | ficha, almacén, control, movimientos
PASO B2 | OK | esperado: stock total 3882 | visto: 3882 | /stock
PASO P1 | HALLAZGO | esperado: una acción de pasaje | visto: no está | dos ajustes en la ficha
PASO P2 | OK | esperado: A=50 B=20 total=70 y la tarjeta no se mueve | visto: 50 / 20 / 70, Stock Total 3882 | ficha, almacenes, /stock, Postgres
PASO F1 | HALLAZGO | esperado: la pantalla avisa y no deja sacar 999 | visto: -999 quedó 0999; cancelado; TEST-B=20 | ficha
PASO F2 | OK | esperado: HTTP 409, TEST-B=20, cero movimientos <= -999 | visto: HTTP 409; TEST-B=20; movs=0 | API y Postgres
PASO C1 | OK | esperado: A=40 B=20 tras recargar, consumido 10 | visto: 40 y 20; consumido -10 | consumo y productos
PASO C2 | OK | esperado: stock total 3872 | visto: 3872 | /stock
PASO R1 | OK | esperado: +100, -30, -20, +20, -10 | visto: esas cinco filas | reportes movimientos
PASO R2 | OK | esperado: niveles 40 y 20 = suma, sesión 70/60, huérfanos 0 | visto: igual | Postgres
PASO O1 | OK | esperado: stock total 10 | visto: 10 | niveles_stock
PASO O2 | OK | esperado: 6 sesiones, niveles intactos | visto: 6 entradas, total 10 | sesiones_conteo
PASO O3 | FALLO | esperado: 24, 24, 24, 24, 48, 48 con redondeo | visto: 0, AUSENTE, 0, 0, 0, AUSENTE | pedidos
PASO O4 | FALLO | esperado: pendientes 1 | visto: 0 | /stock
PASO O5 | OK | esperado: el sugerido del 2026-09-21 no cambia al recargar | visto: 0 → 0 | pedidos
PASO O6 | FALLO | esperado: 20, 10, 17.5, 14, 30, 30 sin redondeo | visto: 0, AUSENTE, 0, 0, 0, AUSENTE | pedidos
PASO O7 | FALLO | esperado: semana 2.5 y la fecha 2026-09-21 en 20 | visto: semana ausente; fecha 0 | pedidos
PASO O8 | FALLO | esperado: un pedido Pendiente de TEST | visto: sin orden; la pantalla rechazó cantidad 0 | pedidos
PASO N1 | FALLO | esperado: con auto ON y stock-bajo OFF, campana avisa TEST-ALERTA en 8 | visto: campana sin ese aviso | campana
PASO N2 | FALLO | esperado: auto OFF quita el aviso de 20 | visto: ese aviso nunca apareció; TEST no está en alertas | campana y reportes
PASO N3 | OK | esperado: stock 8 y una venta -200 | visto: stock 8, venta -200 | ficha y movimientos
PASO N4 | OK | esperado: 8 en campana, inicio, dashboard y reportes, weekly=46 | visto: 8 en los cuatro, weekly 46, pendientes 0 | cuatro pantallas
PASO N5 | OK | esperado: al apagar stock bajo, el aviso semanal se va | visto: campana sin TEST-ALERTA | campana
PASO N6 | FALLO | esperado: Jueves no avisa, Miércoles sí | visto: ambos días avisan | campana
PASO N7 | OK | esperado: un pendiente de 38 saca TEST-ALERTA | visto: ausente en los cuatro lugares | campana, /stock, /, reportes
PASO N8 | HALLAZGO | esperado: un mínimo configurable | visto: no hay campo | configuración stock
PASO Z1 | OK | esperado: BEB-004 nivel=movimientos=10 | visto: 10 y 10 | Postgres
PASO Z2 | OK | esperado: BEB-005 nivel=movimientos=8 | visto: 8 y 8, con la venta -200 dentro de la suma | Postgres
PASO Z3 | OK | esperado: consumos 30, 20, 50, 10, 40, 10 y -10 | visto: esas siete filas | sesiones_conteo
PASO Z4 | FALLO | esperado: pendientes de TEST y de TEST-ALERTA, negativos=0 | visto: no hay pendiente de BEB-004; PED-006 Pendiente 38 de BEB-005; negativos=0 | ordenes_compra
```

## Frases

La Actividad Reciente de stock quedó en «Sin actividad reciente» y no mostró las altas. El inicio general no muestra el Stock Total que sí muestra `/stock`. No hay pasaje entre almacenes; se movieron 20 con dos ajustes y el total se conservó. En la ficha, escribir -999 dejó 0999 y no avisó faltante; se canceló sin tocar stock, y la API respondió 409. Con redondeo prendido los sugeridos salieron 0 en vez de 24, 24, 24, 24, 48 y 48. No se creó el pendiente de TEST porque la pantalla no guardó cantidad 0. Sin redondeo siguieron en 0 en vez de 20, 10, 17.5, 14, 30 y 30. No existe la opción Semana, y la fecha 2026-09-21 quedó en 0 en vez de 20. Con alertas automáticas prendidas y stock bajo apagado, la campana no avisó TEST-ALERTA en 8 sin ventas, así que apagar las automáticas no tuvo un aviso de 20 que quitar. Jueves y Miércoles avisaron igual. El texto del interruptor habla de un mínimo y el panel no tiene ese campo. Por eso tampoco quedó el pedido pendiente de TEST; sí quedó PED-006 por 38 de TEST-ALERTA.
