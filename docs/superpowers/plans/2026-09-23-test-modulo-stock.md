# Test en vivo del módulo de stock — Plan de ejecución

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recorrer el admin de stock ya levantado y dejar en el chat un informe de qué número cierra y cuál no.

**Architecture:** No se escribe código. Cada tarea opera el admin en el navegador, y donde el spec lo pide consulta Postgres o inserta sesiones de historia sin mover stock. El informe es una lista de líneas `PASO | OK/FALLO/HALLAZGO | esperado | visto | dónde`. Las tareas comparten el mismo producto `TEST` y no se pueden partir en planes separados.

**Tech Stack:** Admin Vite en http://localhost:5173 (hash router), API Nest en http://localhost:3001, Postgres `lch_stock` en Docker (`lch` / `lch_dev_pass`).

**Spec:** `docs/superpowers/specs/2026-09-23-test-modulo-stock-design.md`

## Global Constraints

- Forma: recorrido en vivo del admin. Informe en el chat.
- Dónde: http://localhost:5173 con `admin` / `admin123`. API en http://localhost:3001. Postgres local `lch_stock`.
- Datos: registros con prefijo `TEST-`. El producto del pedido usa una categoría que ya exista.
- Código: no se modifica. No hay `git commit` en ninguna tarea.
- Configuración: se anota el valor de cada control antes de tocarlo y se restaura al final.
- Informe: por cada paso, resultado, cantidad esperada, cantidad vista y en qué pantalla.
- No corregir el generador de pedidos, las alertas ni las configuraciones.
- No dejar una suite automática.
- No borrar los registros `TEST-` al final.
- Fuera: web pública, fútbol, online, impresora y APK.
- Un fallo es un número distinto entre ficha, almacén, control, reportes, inicio o base; un sugerido distinto de la tabla del spec; stock negativo o una baja de más que sí descuente; una configuración que se guarda y no cambia el aviso o el pedido; un dato que cambia al recargar.
- Si no existe la acción de pasaje, es un hallazgo. El total conservado sigue siendo obligatorio.
- El selector de período del pedido hoy muestra `Ultimo mes`, `Ultimos 3 meses` y `Ultimos 6 meses`. No tiene semana. Si al ejecutar sigue sin semana, la fila "semana" del oráculo es FALLO por control ausente, no se inventa un clic. `Ultimos 6 meses` no tiene oráculo: se anota y no se compara.

## Cuaderno

Anotarlo en el informe y reutilizarlo. No inventar otro nombre.

| Nombre | Qué es |
|---|---|
| `BASE_STOCK` | Número de la tarjeta Stock Total antes de crear nada |
| `BASE_PRODUCTS` | Cantidad de productos de esa tarjeta |
| `BASE_WAREHOUSES` | Número de la tarjeta Controlar Stock |
| `BASE_PENDING` | Número de Pedidos Pendientes |
| `BASE_NOTIF` | Interruptor Notificaciones del Sistema (General) |
| `BASE_LOW` | Notificaciones de Stock Bajo |
| `BASE_DAY` | Día de Alerta |
| `BASE_AUTO` | Alertas Automáticas |
| `BASE_PACK` | Unidad de Pedido |
| `CATEGORY_ID` | UUID de una categoría ya existente |
| `WA`, `WB` | UUID de `TEST-A` y `TEST-B` |
| `PRODUCT_ID` | UUID del producto `TEST` |
| `SUPPLIER_ID` | UUID del proveedor `TEST` |
| `ALERT_ID` | UUID de `TEST-ALERTA` |
| `WEEKLY` | Promedio semanal calculado en la tarea 10 |

Después de cada cambio de stock o de pedidos, abrir también http://localhost:5173/#/ . El stock total y los pedidos pendientes tienen que ser los mismos que en `#/stock`.

Línea de informe:

```text
PASO <id> | OK/FALLO/HALLAZGO | esperado: <x> | visto: <y> | <pantalla o tabla>
```

Consulta de stock, desde la raíz del repo:

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT d.name, n.quantity FROM niveles_stock n JOIN depositos d ON d.id = n."warehouseId" JOIN productos p ON p.id = n."productId" WHERE p.code = 'TEST-PROD' ORDER BY d.name;
'@
```

---

### Task 1: Línea de base

**Files:**
- Create: ninguno
- Modify: ninguno
- Test: informe, líneas `BASE`

**Interfaces:**
- Consumes: el admin ya levantado
- Produces: `BASE_STOCK`, `BASE_PRODUCTS`, `BASE_WAREHOUSES`, `BASE_PENDING`, `BASE_NOTIF`, `BASE_LOW`, `BASE_DAY`, `BASE_AUTO`, `BASE_PACK`, `CATEGORY_ID`

- [ ] **Step 1: Confirmar que los tres servicios responden**

Abrir http://localhost:5173/#/stock . Tiene que cargar el login o el inicio, no un error de red.

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/api/docs
docker compose exec -T postgres pg_isready -U lch -d lch_stock
```

Esperado: el admin abre, el HTTP de docs no es `000`, y `pg_isready` dice `accepting connections`. Si el admin no está levantado, frenar. No correr `npm run start:all` de nuevo si el puerto 5173 ya responde.

- [ ] **Step 2: Entrar**

Si pide login: usuario `admin`, contraseña `admin123`. Ir a http://localhost:5173/#/stock .

- [ ] **Step 3: Anotar las cuatro tarjetas**

Leer Stock Total, el subtítulo de cantidad de productos, Controlar Stock (cantidad de almacenes) y Pedidos Pendientes.

```text
PASO BASE | OK | stock=<BASE_STOCK> productos=<BASE_PRODUCTS> almacenes=<BASE_WAREHOUSES> pendientes=<BASE_PENDING> | inicio /stock
```

`BASE_STOCK` es el entero de la tarjeta, sin el texto `uds`.

- [ ] **Step 4: Anotar configuración**

http://localhost:5173/#/configuracion

Pestaña General. Anotar si **Notificaciones del Sistema** está prendido (`BASE_NOTIF`).

Pestaña Stock. Anotar:

- Notificaciones de Stock Bajo → `BASE_LOW`
- Día de Alerta de Stock Faltante → `BASE_DAY` (texto del combo, por ejemplo `Jueves`)
- Alertas Automáticas → `BASE_AUTO`
- Unidad de Pedido por Defecto → `BASE_PACK`

- [ ] **Step 5: Categoría existente**

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT id, name FROM categorias ORDER BY name LIMIT 5;
'@
```

Guardar un `id` en `CATEGORY_ID`. No crear categoría.

- [ ] **Step 6: No commit**

No ejecutar git. El spec prohíbe cambiar código.

---

### Task 2: Maestros

**Files:**
- Create: ninguno
- Modify: ninguno
- Test: informe, líneas `M1` a `M4`

**Interfaces:**
- Consumes: `CATEGORY_ID`, `BASE_PRODUCTS`, `BASE_WAREHOUSES`, `BASE_STOCK`
- Produces: `WA`, `WB`, `PRODUCT_ID`, `SUPPLIER_ID`. Stock de `TEST` = 0. El producto está en el proveedor.

- [ ] **Step 1: Crear los dos almacenes**

http://localhost:5173/#/almacenes

Crear `TEST-A`, ubicación `Test`, y `TEST-B`, ubicación `Test`.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -t -A -c @'
SELECT name || ' ' || id FROM depositos WHERE name IN ('TEST-A','TEST-B') ORDER BY name;
'@
```

Guardar los UUID en `WA` y `WB`.

- [ ] **Step 2: Crear el producto en 0**

http://localhost:5173/#/productos . Nuevo producto:

- Nombre `TEST`
- Código `TEST-PROD`
- Categoría: la de `CATEGORY_ID`
- Unidad `unidades`
- Unidad de pedido `24`
- Stock en `TEST-A`: `0`. No cargar stock inicial mayor a 0.

Abrir la ficha y comprobar nombre, código, unidad de pedido 24 y stock 0.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -t -A -c @'
SELECT id || ' orderUnit=' || COALESCE("orderUnit"::text,'null') FROM productos WHERE code = 'TEST-PROD';
'@
```

Guardar el UUID en `PRODUCT_ID`. Esperado: `orderUnit=24`.

- [ ] **Step 3: Crear el proveedor y asignarle el producto**

http://localhost:5173/#/proveedores . Nombre `TEST`. Asignar el producto `TEST`.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT s.id, s.name, p.code FROM proveedores s JOIN proveedores_productos sp ON sp."supplierId" = s.id JOIN productos p ON p.id = sp."productId" WHERE s.name = 'TEST';
'@
```

Guardar `SUPPLIER_ID`. Esperado: una fila, código `TEST-PROD`.

- [ ] **Step 4: Dashboard de maestros**

http://localhost:5173/#/stock

Esperado: productos = `BASE_PRODUCTS + 1`, almacenes = `BASE_WAREHOUSES + 2`, stock total = `BASE_STOCK` (el alta fue 0). Actividad reciente, en el momento de cada alta, muestra el alta del almacén y el alta del producto. El dashboard general (http://localhost:5173/#/ ) muestra el mismo stock total y los mismos pedidos pendientes.

```text
PASO M1 | OK/FALLO | esperado: TEST-A y TEST-B | visto: <nombres> | almacenes
PASO M2 | OK/FALLO | esperado: TEST / TEST-PROD / unidad 24 / stock 0 | visto: <texto> | productos
PASO M3 | OK/FALLO | esperado: proveedor TEST con TEST-PROD | visto: <filas> | proveedores y proveedores_productos
PASO M4 | OK/FALLO | esperado: productos BASE+1, almacenes BASE+2, stock BASE | visto: <tarjetas> | /stock
```

- [ ] **Step 5: No commit**

---

### Task 3: Alta de 100

**Files:**
- Modify: ninguno
- Test: informe `A1` a `A3`

**Interfaces:**
- Consumes: `PRODUCT_ID`, `WA`, `BASE_STOCK`
- Produces: stock `TEST-A` = 100. Movimiento de +100. Stock total del inicio = `BASE_STOCK + 100`.

- [ ] **Step 1: Subir el stock en la ficha**

http://localhost:5173/#/productos . Editar `TEST`. En Stock por Almacén, `TEST-A` = `100`. Guardar.

- [ ] **Step 2: Leer los cuatro lugares**

| Dónde | URL | Esperado |
|---|---|---|
| Ficha | `#/productos` | `TEST-A` 100 |
| Almacén | `#/almacenes` | `TEST-A` incluye `TEST` con 100 |
| Control | `#/consumo`, almacén `TEST-A` desplegado | 100 |
| Reportes | `#/reportes?tab=movimientos`, buscar `TEST` | movimiento +100 |

Inicio `#/stock`: Stock Total = `BASE_STOCK + 100`. Actividad reciente muestra el cambio.

- [ ] **Step 3: Cerrar contra la base**

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT d.name, n.quantity FROM niveles_stock n JOIN depositos d ON d.id = n."warehouseId" JOIN productos p ON p.id = n."productId" WHERE p.code = 'TEST-PROD'; SELECT m.type, m.quantity, d.name FROM movimientos_stock m LEFT JOIN depositos d ON d.id = m."warehouseId" JOIN productos p ON p.id = m."productId" WHERE p.code = 'TEST-PROD' ORDER BY m."createdAt";
'@
```

Esperado: nivel `TEST-A` = 100. Un movimiento de cantidad `100`.

```text
PASO A1 | OK/FALLO | esperado: 100 en ficha, almacén, control y reportes | visto: <cuatro números> | cuatro pantallas
PASO A2 | OK/FALLO | esperado: stock total BASE+100 | visto: <tarjeta> | /stock
PASO A3 | OK/FALLO | esperado: nivel 100 y movimiento +100 | visto: <filas> | niveles_stock y movimientos_stock
```

- [ ] **Step 4: No commit**

---

### Task 4: Baja de 30

**Files:**
- Modify: ninguno
- Test: informe `B1` `B2`

**Interfaces:**
- Consumes: stock 100 en `TEST-A`, `BASE_STOCK`
- Produces: `TEST-A` = 70. Movimiento −30. Stock total = `BASE_STOCK + 70`.

- [ ] **Step 1: Bajar la ficha a 70**

Editar `TEST`. `TEST-A` = `70`. Guardar.

- [ ] **Step 2: Comparar**

Ficha, almacén `TEST-A`, control y movimientos muestran 70 y un movimiento de −30. Inicio: Stock Total = `BASE_STOCK + 70`.

```text
PASO B1 | OK/FALLO | esperado: 70 en los cuatro lugares y movimiento -30 | visto: <números> | ficha, almacén, control, movimientos
PASO B2 | OK/FALLO | esperado: stock total BASE+70 | visto: <tarjeta> | /stock
```

- [ ] **Step 3: No commit**

---

### Task 5: Pasaje de 20

**Files:**
- Modify: ninguno
- Test: informe `P1` `P2`

**Interfaces:**
- Consumes: `TEST-A` = 70, `TEST-B` sin cantidad o 0, total 70
- Produces: `TEST-A` = 50, `TEST-B` = 20, total 70. Stock total del inicio no cambia (`BASE_STOCK + 70`).

- [ ] **Step 1: Buscar una acción de pasaje**

En almacenes, ficha de producto y control, buscar un botón de pasar stock de un almacén a otro. Si no existe, anotar:

```text
PASO P1 | HALLAZGO | esperado: una acción de pasaje | visto: no está | se hacen dos ajustes en la ficha
```

- [ ] **Step 2: Mover 20**

Editar `TEST`. Dejar `TEST-A` = `50` y `TEST-B` = `20`. Si `TEST-B` no está en la lista, usar **+ Agregar ubicación**, elegir `TEST-B` y poner `20`. Guardar.

- [ ] **Step 3: Comprobar el total**

Ficha: `TEST-A` 50, `TEST-B` 20, suma 70. Almacén y control muestran los mismos dos números. Inicio: Stock Total sigue en `BASE_STOCK + 70`.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT d.name, n.quantity FROM niveles_stock n JOIN depositos d ON d.id = n."warehouseId" JOIN productos p ON p.id = n."productId" WHERE p.code = 'TEST-PROD' ORDER BY d.name;
'@
```

Esperado: `TEST-A` 50, `TEST-B` 20.

```text
PASO P2 | OK/FALLO | esperado: A=50 B=20 total=70 y la tarjeta no se mueve | visto: <números> | ficha, almacenes, /stock, niveles_stock
```

- [ ] **Step 4: No commit**

---

### Task 6: Faltante

**Files:**
- Modify: ninguno
- Test: informe `F1` `F2`

**Interfaces:**
- Consumes: `PRODUCT_ID`, `WB`, `TEST-B` = 20
- Produces: `TEST-B` sigue en 20. No hay movimiento de −999.

- [ ] **Step 1: Intentar la baja de más en la ficha**

Editar `TEST`. El input de cantidad tiene `min=0`, así que no puede guardar un stock negativo. Escribir `-999` en `TEST-B` y anotar qué queda en el campo (0, vacío o -999). No guardar un 0: cancelar si el campo cambió a otro número. `TEST-B` tiene que seguir en 20.

```text
PASO F1 | HALLAZGO u OK | esperado: la pantalla avisa y no deja sacar 999 | visto: <qué hizo el input> | ficha de producto
```

Si el campo acepta el intento y al guardar descuenta, es FALLO.

- [ ] **Step 2: La API rechaza el faltante**

```powershell
$loginBody = @{ username = 'admin'; password = 'admin123' } | ConvertTo-Json -Compress
$login = curl.exe -s -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" -d $loginBody
$token = ($login | ConvertFrom-Json).access_token
$adjustBody = @{ warehouseId = 'PEGAR-WB'; quantity = -999 } | ConvertTo-Json -Compress
curl.exe -s -w "`nHTTP:%{http_code}`n" -X POST "http://localhost:3001/stock/products/PEGAR-PRODUCT_ID/stock/adjust" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d $adjustBody
```

Reemplazar `PEGAR-PRODUCT_ID` y `PEGAR-WB` por los UUID del cuaderno antes de ejecutar. Esperado: HTTP 409 y un mensaje de stock insuficiente. Recargar `#/productos`: `TEST-B` = 20.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT COUNT(*) AS movs_de_menos_999 FROM movimientos_stock m JOIN productos p ON p.id = m."productId" WHERE p.code = 'TEST-PROD' AND m.quantity <= -999;
'@
```

Esperado: `0`.

```text
PASO F2 | OK/FALLO | esperado: HTTP 409, TEST-B=20, cero movimientos <= -999 | visto: <código y cantidad> | API y niveles_stock
```

- [ ] **Step 3: No commit**

---

### Task 7: Control regular de hoy

**Files:**
- Modify: ninguno
- Test: informe `C1` `C2`

**Interfaces:**
- Consumes: `TEST-A` = 50, `TEST-B` = 20, total 70, `BASE_STOCK`
- Produces: `TEST-A` = 40, `TEST-B` = 20, total 60. Sesión de hoy, tipo regular, esperado 70, contado 60, consumido 10. Stock total del inicio = `BASE_STOCK + 60`.

- [ ] **Step 1: Contar en la pantalla**

http://localhost:5173/#/consumo . Tipo de fecha **Regular**. Desplegar `TEST-A`. Dejar el contado de `TEST` en `40` (había 50; el consumido de esa línea es 10). Desplegar `TEST-B` y no cambiar el 20. Guardar el control.

- [ ] **Step 2: Leer la pantalla y recargar**

La línea de `TEST-A` muestra había 50 y contado 40, o el consumido 10. Recargar `#/consumo` y `#/productos`. Siguen `TEST-A` 40 y `TEST-B` 20. Inicio: Stock Total = `BASE_STOCK + 60`. Actividad reciente muestra el registro de consumo regular.

```text
PASO C1 | OK/FALLO | esperado: A=40 B=20 después de recargar, consumido de línea 10 | visto: <números> | consumo y productos
PASO C2 | OK/FALLO | esperado: stock total BASE+60 | visto: <tarjeta> | /stock
```

- [ ] **Step 3: No commit**

---

### Task 8: Reportes y primera lectura de la base

**Files:**
- Modify: ninguno
- Test: informe `R1` `R2`

**Interfaces:**
- Consumes: los movimientos de las tareas 3 a 7 y la sesión de hoy
- Produces: confirmación de que la base del paso 6 del spec cierra. El stock sigue en 40 y 20.

- [ ] **Step 1: Movimientos en reportes**

http://localhost:5173/#/reportes?tab=movimientos . Buscar `TEST`.

Tienen que verse, con el mismo signo que la ficha: +100, −30, el pasaje (dos ajustes, −20 en `TEST-A` y +20 en `TEST-B`, si no hubo acción de pasaje) y el control (−10 en `TEST-A`, de 50 a 40).

- [ ] **Step 2: SQL del checkpoint**

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT p.code, p."orderUnit", d.name, n.quantity FROM productos p JOIN niveles_stock n ON n."productId" = p.id JOIN depositos d ON d.id = n."warehouseId" WHERE p.code = 'TEST-PROD' ORDER BY d.name; SELECT d.name, SUM(m.quantity) AS suma FROM movimientos_stock m JOIN productos p ON p.id = m."productId" LEFT JOIN depositos d ON d.id = m."warehouseId" WHERE p.code = 'TEST-PROD' GROUP BY d.name ORDER BY d.name; SELECT s.date, s."dateType", e.expected, e.counted, (e.expected - e.counted) AS consumido FROM sesiones_conteo s JOIN entradas_conteo e ON e."sessionId" = s.id JOIN productos p ON p.id = e."productId" WHERE p.code = 'TEST-PROD' ORDER BY s."createdAt"; SELECT COUNT(*) AS huerfanos FROM movimientos_stock m LEFT JOIN productos p ON p.id = m."productId" WHERE p.id IS NULL;
'@
```

Esperado:

- Una fila de producto, `orderUnit` 24.
- Niveles: `TEST-A` 40, `TEST-B` 20. Ninguno negativo.
- Suma de movimientos: `TEST-A` 40, `TEST-B` 20.
- Sesión de hoy del producto: esperado 70, contado 60, consumido 10. El texto de `date` puede llevar hora o formato local; el día calendario es 2026-09-23.
- `huerfanos` = 0.
- El proveedor `TEST` sigue vinculado a `TEST-PROD` (la consulta de la tarea 2).

```text
PASO R1 | OK/FALLO | esperado: +100, -30, pasaje 20, control -10 | visto: <filas de la pantalla> | reportes movimientos
PASO R2 | OK/FALLO | esperado: niveles 40 y 20 = suma de movimientos, sesión 70/60, huerfanos 0 | visto: <tablas> | Postgres
```

- [ ] **Step 3: No commit**

---

### Task 9: Pedido automático

**Files:**
- Modify: ninguno. El SQL solo inserta sesiones; no toca `niveles_stock` ni `movimientos_stock`.
- Test: informe `O1` a `O8`

**Interfaces:**
- Consumes: `PRODUCT_ID`, stock total 60 (`TEST-A` 40 + `TEST-B` 20), sesión de hoy consumido 10, `BASE_PACK`, `BASE_PENDING`, `SUPPLIER_ID`
- Produces: stock total 10. Cinco sesiones insertadas más la de hoy. Un pedido pendiente de `TEST` con las cantidades que mostró la pantalla. `BASE_PENDING` sube 1 en el inicio.

Oráculo con stock actual 10 y unidad de pedido 24. La sesión de hoy (consumido 10) entra en semana, mes y 3 meses.

| Selección | Interruptor unidad de pedido | Sugerido |
|---|---|---|
| Fecha 2026-09-21, Regular | prendido | 24 |
| Semana, Regular | prendido | 24 |
| Mes, Regular | prendido | 24 |
| 3 meses, Regular | prendido | 24 |
| Fecha 2026-09-22, After | prendido | 48 |
| Semana, After | prendido | 48 |
| Fecha 2026-09-21, Regular | apagado | 20 |
| Semana, Regular | apagado | 10 |
| Mes, Regular | apagado | 17,5 |
| 3 meses, Regular | apagado | 14 |
| Fecha 2026-09-22, After | apagado | 30 |
| Semana, After | apagado | 30 |

Después del control extra del 2026-09-20 con consumido −10, semana Regular con el interruptor apagado = 2,5. La fecha 2026-09-21 sigue en 20.

- [ ] **Step 1: Dejar el stock total en 10 sin un control nuevo**

Editar `TEST`. Poner `TEST-A` = `0` y `TEST-B` = `10`. Guardar. No entrar a Controlar Stock.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT SUM(n.quantity) AS total FROM niveles_stock n JOIN productos p ON p.id = n."productId" WHERE p.code = 'TEST-PROD';
'@
```

Esperado: `10`.

- [ ] **Step 2: Insertar las cinco sesiones de historia**

`expected - counted` es el consumido. No hay UPDATE a niveles ni movimientos.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -v ON_ERROR_STOP=1 -c @"
INSERT INTO sesiones_conteo (id, "createdAt", date, "dateType", "operatorName")
SELECT gen_random_uuid(), ts, d, tipo, 'plan-test'
FROM (VALUES
  ('2026-09-21'::date, 'regular', 30::numeric),
  ('2026-09-22'::date, 'regular', 20::numeric),
  ('2026-09-01'::date, 'regular', 50::numeric),
  ('2026-07-23'::date, 'regular', 10::numeric),
  ('2026-09-22'::date, 'after', 40::numeric)
) AS v(d, tipo, consumido)
JOIN LATERAL (SELECT (v.d + time '15:00') AT TIME ZONE 'America/Argentina/Buenos_Aires' AS ts) z ON true;

INSERT INTO entradas_conteo (id, "sessionId", "productId", "productName", unit, expected, counted, "createdAt")
SELECT gen_random_uuid(), s.id, p.id, 'TEST', 'unidades',
  CASE WHEN v.consumido >= 0 THEN v.consumido ELSE 0 END,
  CASE WHEN v.consumido >= 0 THEN 0 ELSE -v.consumido END,
  s."createdAt"
FROM (VALUES
  ('2026-09-21', 'regular', 30::numeric),
  ('2026-09-22', 'regular', 20::numeric),
  ('2026-09-01', 'regular', 50::numeric),
  ('2026-07-23', 'regular', 10::numeric),
  ('2026-09-22', 'after', 40::numeric)
) AS v(d, tipo, consumido)
JOIN sesiones_conteo s ON s.date = v.d AND s."dateType" = v.tipo AND s."operatorName" = 'plan-test'
JOIN productos p ON p.code = 'TEST-PROD';
"@
```

Comprobar que los niveles no se movieron (siguen sumando 10) y que hay 6 sesiones de `TEST-PROD` (las 5 más la de hoy).

- [ ] **Step 3: Calcular con el interruptor prendido**

http://localhost:5173/#/configuracion , pestaña Stock. Dejar **Unidad de Pedido por Defecto** prendida. Recargar y confirmar que sigue prendida.

http://localhost:5173/#/pedidos . Nuevo pedido. Proveedor `TEST`. Para cada fila prendida de la tabla:

- Tipo Regular o After, como dice la fila.
- Período: `Ultimo mes` para la fila Mes, `Ultimos 3 meses` para la fila 3 meses.
- Si la fila es Semana y el combo no tiene semana ni "últimos 7 días", no elegir `Ultimos 6 meses` en su lugar. Anotar FALLO de control ausente.
- Fecha específica: la de la fila, o vacía si la fila es un promedio.
- **Calcular Sugerencias**. Leer la cantidad de `TEST`. No editarla.

Guardar un solo pedido, el de la fecha 2026-09-21 Regular, con las cantidades que la pantalla dejó marcadas. No corregirlas para que den 24.

Inicio `#/stock`: Pedidos Pendientes = `BASE_PENDING + 1`. Actividad reciente muestra la creación del pedido. Recargar `#/pedidos`, repetir solo la fecha 2026-09-21 Regular y comprobar que el sugerido no cambió.

- [ ] **Step 4: Calcular con el interruptor apagado**

Apagar **Unidad de Pedido por Defecto**, recargar, confirmar que sigue apagado. Repetir las seis selecciones. Comparar contra la mitad "apagado" de la tabla. `Ultimos 6 meses` se anota sin oráculo.

- [ ] **Step 5: Consumido negativo**

Con el interruptor todavía apagado:

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -v ON_ERROR_STOP=1 -c @"
WITH s AS (
  INSERT INTO sesiones_conteo (id, "createdAt", date, "dateType", "operatorName")
  VALUES (gen_random_uuid(), ('2026-09-20'::date + time '15:00') AT TIME ZONE 'America/Argentina/Buenos_Aires', '2026-09-20', 'regular', 'plan-test')
  RETURNING id, "createdAt"
)
INSERT INTO entradas_conteo (id, "sessionId", "productId", "productName", unit, expected, counted, "createdAt")
SELECT gen_random_uuid(), s.id, p.id, 'TEST', 'unidades', 0, 10, s."createdAt"
FROM s JOIN productos p ON p.code = 'TEST-PROD';
"@
```

Volver a calcular semana Regular. Esperado: 2,5. Fecha 2026-09-21 Regular sigue en 20. El stock total sigue en 10.

```text
PASO O1 | OK/FALLO | esperado: stock total 10 | visto: <suma> | niveles_stock
PASO O2 | OK/FALLO | esperado: 6 sesiones, niveles intactos | visto: <conteo> | sesiones_conteo
PASO O3 | OK/FALLO | esperado: 24, 24, 24, 24, 48, 48 con interruptor prendido | visto: <seis números o control ausente> | pedidos
PASO O4 | OK/FALLO | esperado: pendientes BASE+1 | visto: <tarjeta> | /stock
PASO O5 | OK/FALLO | esperado: el sugerido del 2026-09-21 no cambia al recargar | visto: <número> | pedidos
PASO O6 | OK/FALLO | esperado: 20, 10, 17.5, 14, 30, 30 con interruptor apagado | visto: <números> | pedidos
PASO O7 | OK/FALLO | esperado: semana apagada pasa a 2.5 y la fecha 2026-09-21 sigue en 20 | visto: <números> | pedidos
PASO O8 | OK/FALLO | esperado: el pedido guardado tiene las cantidades de la pantalla, estado Pendiente, proveedor TEST | visto: <ítems> | pedidos y ordenes_compra
```

- [ ] **Step 6: No commit**

---

### Task 10: Alertas, campana y configuración

**Files:**
- Modify: ninguno
- Test: informe `N1` a `N8`

**Interfaces:**
- Consumes: `BASE_NOTIF`, `BASE_LOW`, `BASE_DAY`, `BASE_AUTO`, `CATEGORY_ID`, `WA`, producto `TEST` sin movimientos `venta`
- Produces: `ALERT_ID`, `WEEKLY`. `TEST-ALERTA` queda en 8, con una venta de 200. Los cuatro controles de stock y la campana general quedan como al empezar. `TEST` no aparece como stock bajo.

- [ ] **Step 1: Prender la campana general solo para esta tarea**

Si `BASE_NOTIF` está apagado, en Configuración → General prender **Notificaciones del Sistema**. Si ya estaba prendido, no tocarlo.

- [ ] **Step 2: Producto en 8, sin ventas**

Crear producto `TEST-ALERTA`, código `TEST-ALERTA`, unidad de pedido `1`, categoría `CATEGORY_ID`, stock 0. Después editar y dejar `8` en `TEST-A`. Guardar `ALERT_ID`.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT COALESCE(SUM(CASE WHEN m.type = 'venta' THEN 1 ELSE 0 END),0) AS ventas, SUM(n.quantity) AS stock FROM productos p LEFT JOIN movimientos_stock m ON m."productId" = p.id LEFT JOIN niveles_stock n ON n."productId" = p.id WHERE p.code = 'TEST-ALERTA';
'@
```

Esperado: `ventas` 0, `stock` 8.

- [ ] **Step 3: Alerta de 20 unidades, sin demanda**

Configuración → Stock.

1. **Alertas Automáticas** prendidas. **Notificaciones de Stock Bajo** apagadas. Recargar. La campana muestra "Stock bajo" de `TEST-ALERTA`.
2. Apagar **Alertas Automáticas**. Recargar. Ese aviso de 20 no está.
3. Dejar las dos apagadas. Recargar. No hay "Stock bajo" de `TEST-ALERTA`.
4. Confirmar en `#/reportes?tab=alertas` y en `#/stock` que `TEST` no está en la lista.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT key, value FROM configuraciones WHERE key IN ('stock.lowStockNotifications','stock.autoAlerts','stock.alertDay','stock.packRounding') ORDER BY key;
'@
```

Cada clave tiene que coincidir con el interruptor recién guardado.

- [ ] **Step 4: Vender 200**

Subir `TEST-ALERTA` a 208 en `TEST-A` (editar la ficha: 8 → 208).

http://localhost:5173/#/ventas . En el módulo de productos de venta, **Nuevo producto**:

- Nombre `TEST-ALERTA-VENTA`
- Tipo simple, no promo
- Receta: producto de inventario `TEST-ALERTA`, cantidad `1`

En el mostrador, vender cantidad `200` de `TEST-ALERTA-VENTA` y cobrar el ticket. El stock de `TEST-ALERTA` vuelve a 8. Movimientos: un `venta` de −200 (la cantidad del libro es negativa en una salida).

```powershell
node -e "const now=new Date(); const cut=new Date(now); cut.setMonth(cut.getMonth()-1); const days=Math.max(1,Math.floor((now-cut)/86400000)); const weekly=Math.ceil((200/days)*7); console.log(JSON.stringify({days,weekly,cover:weekly-8}));"
```

Guardar `weekly` en `WEEKLY` y `cover` para el pedido. Anotar días y weekly en el informe.

- [ ] **Step 5: Alerta por promedio semanal**

**Notificaciones de Stock Bajo** prendidas. **Alertas Automáticas** apagadas. Recargar.

Esperado, el mismo 8 en los cuatro lugares:

- Campana: título `Stock bajo`, texto `TEST-ALERTA: 8 uds restantes`, severidad de error (menos de 10).
- `#/stock`: la tarjeta Alertas y la lista de abajo cuentan igual, e incluyen `TEST-ALERTA` con 8.
- `#/`: bloque Alertas de Stock Bajo, con 8. Ese bloque muestra como máximo 4. Si `TEST-ALERTA` no entra en los 4, HALLAZGO de cupo, no FALLO de reportes.
- `#/reportes?tab=alertas`: stock actual 8, pedidos pendientes 0, promedio semanal = `WEEKLY`.

La campana muestra como máximo 5 alertas de stock, las de error antes que las de aviso. Si `TEST-ALERTA` no entra en las 5, HALLAZGO de cupo.

Apagar **Notificaciones de Stock Bajo**. Recargar. El aviso por promedio semanal de `TEST-ALERTA` no está.

- [ ] **Step 6: Día de alerta**

Volver a prender **Notificaciones de Stock Bajo**. Hoy es miércoles 2026-09-23.

- Combo en `Jueves`. Recargar. Hoy no avisa `TEST-ALERTA`.
- Combo en `Miercoles` (sin acento, como la opción del combo). Recargar. Sí avisa.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT key, value FROM configuraciones WHERE key = 'stock.alertDay';
'@
```

El valor es el texto del combo, sin acento.

- [ ] **Step 7: El pedido pendiente tapa el faltante**

En `#/proveedores`, agregar `TEST-ALERTA` al proveedor `TEST`. Con **Notificaciones de Stock Bajo** prendidas y el día en `Miercoles`, crear un pedido de ese proveedor con `TEST-ALERTA` y cantidad `cover` (`WEEKLY - 8`). No recibirlo.

`TEST-ALERTA` desaparece de la campana, de `#/stock`, de `#/` y de `#/reportes?tab=alertas`.

Buscar en Configuración → Stock un campo para cargar "el mínimo configurado". No está en el panel (solo hay cuatro controles). 

```text
PASO N8 | HALLAZGO | esperado: un mínimo configurable, según el texto del interruptor | visto: no hay campo | configuracion stock
```

- [ ] **Step 8: Restaurar**

Devolver los cuatro controles de Stock y **Notificaciones del Sistema** a `BASE_LOW`, `BASE_DAY`, `BASE_AUTO`, `BASE_PACK` y `BASE_NOTIF`. Recargar y leerlos de nuevo.

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT key, value FROM configuraciones WHERE key IN ('stock.lowStockNotifications','stock.alertDay','stock.autoAlerts','stock.packRounding') ORDER BY key;
'@
```

Tienen que coincidir con la línea de base. La campana general también.

```text
PASO N1 | OK/FALLO | esperado: con auto ON y stock-bajo OFF, campana avisa TEST-ALERTA en 8 sin ventas | visto: <texto> | campana
PASO N2 | OK/FALLO | esperado: auto OFF quita el aviso de 20; las dos OFF no muestran TEST-ALERTA; TEST no está en alertas | visto: <listas> | campana y reportes
PASO N3 | OK/FALLO | esperado: después de vender 200, stock 8 y un movimiento venta | visto: <stock y tipo> | ficha y movimientos_stock
PASO N4 | OK/FALLO | esperado: 8 en campana, inicio, dashboard y reportes, weekly=<WEEKLY>, pendientes 0 | visto: <cuatro lugares> | cuatro pantallas
PASO N5 | OK/FALLO | esperado: al apagar notificaciones de stock bajo, el aviso semanal se va | visto: <campana> | campana
PASO N6 | OK/FALLO | esperado: Jueves no avisa, Miercoles sí | visto: <campana y value> | campana y configuraciones
PASO N7 | OK/FALLO | esperado: un pendiente de <cover> saca TEST-ALERTA de los cuatro lugares | visto: <listas> | campana, /stock, /, reportes
```

- [ ] **Step 9: No commit**

---

### Task 11: Cierre de la base y el informe

**Files:**
- Modify: ninguno
- Test: informe `Z1` a `Z4` y el resumen final en el chat

**Interfaces:**
- Consumes: todo lo anterior
- Produces: el informe completo en el chat. Los registros `TEST-` se quedan.

- [ ] **Step 1: Lectura final**

```powershell
docker compose exec -T postgres psql -U lch -d lch_stock -c @'
SELECT p.code, SUM(n.quantity) AS nivel, (SELECT SUM(m.quantity) FROM movimientos_stock m WHERE m."productId" = p.id) AS movimientos FROM productos p JOIN niveles_stock n ON n."productId" = p.id WHERE p.code IN ('TEST-PROD','TEST-ALERTA') GROUP BY p.id, p.code ORDER BY p.code; SELECT s.date, s."dateType", (e.expected - e.counted) AS consumido FROM sesiones_conteo s JOIN entradas_conteo e ON e."sessionId" = s.id JOIN productos p ON p.id = e."productId" WHERE p.code = 'TEST-PROD' AND (s."operatorName" = 'plan-test' OR s."createdAt"::date = DATE '2026-09-23') ORDER BY s.date, s."dateType"; SELECT o."orderNumber", o.status, o.provider, i."quantityOrdered" FROM ordenes_compra o JOIN items_orden_compra i ON i."purchaseOrderId" = o.id JOIN productos p ON p.id = i."productId" WHERE p.code IN ('TEST-PROD','TEST-ALERTA') AND o.status = 'Pendiente' ORDER BY p.code, o."createdAt"; SELECT COUNT(*) AS negativos FROM niveles_stock n JOIN productos p ON p.id = n."productId" WHERE p.code IN ('TEST-PROD','TEST-ALERTA') AND n.quantity < 0;
'@
```

Esperado:

- `TEST-PROD`: nivel 10 y movimientos 10.
- `TEST-ALERTA`: nivel 8 y movimientos 8, incluyendo la venta de 200 dentro de esa suma.
- Sesiones de `TEST-PROD`: consumidos 30, 20, 50, 10 (2026-07-23), 40 after, 10 del control de hoy, y −10 del 2026-09-20.
- Pedido de `TEST` en estado `Pendiente`, proveedor `TEST`, cantidades iguales a las que confirmó la pantalla en O8.
- Pedido de `TEST-ALERTA` en `Pendiente` con cantidad `cover`.
- `negativos` = 0.

```text
PASO Z1 | OK/FALLO | esperado: TEST-PROD nivel=movimientos=10 | visto: <fila> | Postgres
PASO Z2 | OK/FALLO | esperado: TEST-ALERTA nivel=movimientos=8 | visto: <fila> | Postgres
PASO Z3 | OK/FALLO | esperado: sesiones 30, 20, 50, 10, 40, 10 y -10 | visto: <filas> | sesiones_conteo
PASO Z4 | OK/FALLO | esperado: pendientes con las cantidades de pantalla y negativos=0 | visto: <filas> | ordenes_compra
```

- [ ] **Step 2: Publicar el informe**

En el chat, en este orden: las líneas BASE, M, A, B, P, F, C, R, O, N y Z. Después una frase por cada FALLO y cada HALLAZGO. No proponer el parche. No borrar `TEST-A`, `TEST-B`, `TEST`, `TEST-ALERTA`, `TEST-ALERTA-VENTA` ni los pedidos.

- [ ] **Step 3: No commit**
