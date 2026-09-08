# Plan — Consumo interno como venta a $0

Pedido del usuario: "Registrar Consumo" debería vivir en el módulo de
Ventas, no en Inventario. Un consumo es como un producto vendido que no
suma precio, no imprime ticket, pero disminuye el stock según la receta del
producto. Tiene que verse marcado como "consumo" en todos lados.

## Decisiones (confirmadas con el usuario antes de programar)

1. **Se elige un producto de VENTA (con receta)**, no un insumo de stock
   directo — igual que si se hubiera vendido.
2. **Se modela como un `TicketVenta` real**, `total: 0`, `origen: 'consumo'`
   — no una tabla aparte. Aparece en el mismo historial que cualquier
   ticket, marcado.
3. **Precio de cada línea forzado a $0** en el ticket (no se guarda el
   precio de catálogo).
4. **Se bloquea igual que una venta** si no hay stock suficiente en la
   receta — sin excepción.
5. **Datos viejos de `ConsumoEmpleado` se descartan** (eran de prueba) — el
   modelo viejo (insumo suelto, sin receta) no tiene equivalente 1:1 en el
   nuevo esquema basado en receta.
6. **Roles**: los mismos que ya podían mutar stock (Admin/SuperAdmin/
   Operador_Stock) + Vendedor/Gerente_Ventas (porque ahora vive en Ventas y
   usa productos de venta).

## Cambios

### Backend

- `schema.prisma`: `OrigenTicket` suma `consumo`. Se elimina el modelo
  `ConsumoEmpleado` y sus relaciones.
- `sales.service.ts`: `checkout()` se refactoriza en un `performCheckout()`
  privado parametrizado por `{ origen, zeroPrice, movementType }`;
  `registerConsumption()` es el mismo circuito (receta multi-insumo, promos,
  `SELECT FOR UPDATE`, `stockAllocations` para reversión) con
  `origen: 'consumo'`, precio forzado a 0, y `MovimientoStock` tipado
  `consumo` en vez de `venta`.
- `POST /sales/consumption`, roles `SALES_CONSUMPTION_ROLES`.
- Se retira `createEmployeeConsumption`/`findAllEmployeeConsumptions` de
  `StockService` y el endpoint `/stock/employee-consumptions`.

### Frontend

- Nueva pestaña "Registrar Consumo" en Ventas (`ConsumptionModule.tsx`),
  usando el mismo `PosProductPicker` que el Mostrador — ya no vive en
  Inventario.
- `VentasPosContext.tsx`: `registerConsumption()` mismo patrón que
  `printTicket` (valida stock, sin imprimir, sin cobrar). `PosTicket.kind`
  suma `'consumo'`.
- Historial (`HistoryModule.tsx`, `MyOrdersModule.tsx`): badge naranja
  "CONSUMO", filtro dedicado, fila "Consumos" en el resumen por operador.
- `sales-metrics.ts`: `getIssuedSales()` excluye `origen === 'consumo'` de
  los totales de venta — un solo punto, todos los reportes de ventas
  heredan la exclusión.
- Reportes de stock (`ReportsPage.tsx`, `reconciliation.ts`): sin cambios —
  ya sumaban `MovimientoStock` por tipo `consumo` de forma agregada, no
  asumían un movimiento por evento.

## Verificado en vivo

Login real, API real, DB reseteada + demo: agregar "Empanadas x3" en
Registrar Consumo → ticket #1002 creado, $0, origen consumo, stock bajó
116→115 (receta de 1 unidad). "Mis Pedidos" y "Reportes → Historial"
muestran el badge CONSUMO y excluyen el ticket de "Ventas". "Reportes → Por
cocina" no lo suma al total recaudado ni a unidades vendidas.

**Hallazgo colateral (no introducido por este cambio):** el rol Vendedor
recibe 403 en `GET /stock/products`, lo que vacía el picker de productos
tanto en Mostrador como en Registrar Consumo — `STOCK_READ_ROLES` no
incluye Vendedor. Es un bug preexistente del Mostrador normal, no algo que
rompió este cambio; queda para una tarea aparte.
