# Integridad del esquema de base de datos — Diseño

**Fecha:** 2026-09-06
**Proyecto:** A de 3 (ver "Contexto y descomposición")
**Estado:** aprobado para planificación

## Problema

El panel de admin pierde y revierte datos, y va lento. La investigación de las tres capas
(esquema Prisma, servicios NestJS, capa de datos de `web-admin`) mostró tres causas
independientes, que se atacan como tres proyectos separados.

Este documento cubre **solo el proyecto A: la integridad del esquema de base de datos**.

La base acepta hoy datos que nunca debería aceptar: filas huérfanas por FKs ausentes,
estados escritos con cualquier string, cantidades negativas de stock, y tablas heredadas sin
ninguna restricción. Cuando un bug del backend escribe basura, la base la guarda en silencio
en lugar de rechazarla, y el error aparece mucho después como "el stock no cierra" o "el
producto no aparece en ninguna consulta".

## Contexto y descomposición

| Proyecto | Alcance | Estado |
|---|---|---|
| **A** | Integridad del esquema de BD | este documento |
| **B** | Correctitud transaccional del backend: transacciones partidas, carreras de stock, paginación, agregación en SQL | pendiente |
| **C** | Arquitectura de datos del admin: eliminar el localStorage-first, pasar a API-first con errores visibles | pendiente |

El orden elegido es de abajo hacia arriba (A → B → C): A cambia los tipos que expone B, y B
cambia los contratos que consume C. Cada proyecto tiene su propio spec, plan e implementación.

## Restricciones del contexto

- El sistema está **solo en desarrollo local**. La base se puede borrar y re-seedear.
- El admin **no necesita funcionar sin conexión**. Si la API falla, el guardado debe fallar
  visiblemente. (Esta decisión define el proyecto C, pero se registra acá porque justifica
  eliminar los caminos de escritura local.)
- No hay clientes desplegados consumiendo la API, así que se pueden romper contratos.

## Decisiones tomadas

| # | Decisión |
|---|---|
| D1 | Aplastar las 7 migraciones actuales en una única baseline generada por Prisma desde el schema corregido. Las viejas se eliminan, no se archivan. |
| D2 | Eliminar las tablas heredadas y su código muerto: `logs_consumo`, `entradas_consumo`, `productos_online` y el módulo `online-catalog`. |
| D3 | Reemplazar `ProductoVenta.category` (string libre) por un FK a `CategoriaVenta`, y mantener `CategoriaWeb` aparte como agrupación de presentación web. |
| D4 | Convertir a enums nativos de Prisma/PostgreSQL los campos cuyos valores válidos están definidos de forma autoritativa en el código. |
| D5 | Mantener los campos derivados (stock materializado, totales, goles) pero blindarlos con `CHECK` constraints y agregar un comando de reconciliación que detecte deriva contra el libro mayor. |
| D6 | Política de borrado uniforme: `Restrict` para catálogo referenciado por historial, `Cascade` para filas de detalle dentro de un padre, `SetNull` para referencias opcionales e informativas. Se mantienen los flags booleanos `active`/`activo`; **no** se agrega `deletedAt`. |
| D7 | Separar los seeds en dos: datos de referencia estrictamente idempotentes (siempre) y datos de demo bajo un flag (opcional). |
| D8 | Verificar con tests de integración contra el PostgreSQL real de docker que intenten insertar datos inválidos y comprueben el rechazo, más un chequeo automatizado de deriva `schema ↔ migraciones`. |
| D9 | Ejecutar por dominios, en tandas verificables: stock → ventas/POS → online/cantina → fútbol → auditoría/config. |
| D10 | Incluir en A la traducción de errores Prisma (P2002/P2003/P2025 → 409/400/404) mediante un filtro global, para que las nuevas restricciones no produzcan errores 500 crudos entre A y B. |

## Arquitectura

`apps/api/prisma/schema.prisma` es la única fuente de verdad. El estado de la base se define
por **dos migraciones**:

1. `<ts>_baseline/migration.sql` — generada íntegramente por
   `prisma migrate diff --from-empty --to-schema-datamodel`. Nunca se edita a mano.
2. `<ts>_constraints/migration.sql` — únicamente las `CHECK` constraints, que el lenguaje de
   Prisma no puede expresar. Es SQL escrito a mano, pero mínimo, aditivo y sin ninguna
   sentencia destructiva.

Esa separación es deliberada: mantiene la baseline regenerable con un comando y confina el SQL
manual a lo que Prisma no cubre. La alternativa (agregar los `CHECK` al final de la baseline)
haría que regenerar la baseline borre las constraints en silencio.

Cada tanda de dominio es un ciclo cerrado: corregir el schema del dominio → borrar y regenerar
la baseline → `prisma migrate reset` con seeds → correr los tests de integridad. Si la tanda no
queda verde, no se pasa a la siguiente.

### Riesgo conocido a verificar

`prisma migrate diff` no representa las `CHECK` constraints en el modelo de datos. Hay que
comprobar que el chequeo de deriva no las reporte como diferencia pendiente. Si las reporta, el
plan de contingencia es sacarlas de `migrations/` y aplicarlas con un script `db:constraints`
que corra después de cada reset, documentado en el runbook.

## Cambios por dominio

### Transversal

**Enums nuevos.** Solo se convierten los campos cuyos valores están definidos de forma
autoritativa en el código. Cada uno se lista con su fuente:

| Enum | Valores | Fuente autoritativa |
|---|---|---|
| `RolUsuario` | `SuperAdmin`, `Admin`, `Operador_Stock`, `Vendedor`, `Gerente_Ventas`, `Operador_Futbol`, `Operador_Cocina` | `src/common/roles.ts:3-15` (`ROLES`) |
| `TipoMovimientoStock` | `venta`, `devolucion`, `venta_anulada`, `ajuste_manual`, `consumo`, `entrada` | `sales.service.ts:126,529`; `stock.service.ts:140,225,541` |
| `UnidadMedida` | `unidades`, `kg`, `litros`, `cajas` | `prisma/seeds/inventory.seed.cjs:7-21` |
| `EstadoOrdenCompra` | `Pendiente`, `Recibido` | `stock.service.ts:389,404,568` |
| `EstadoTicket` | `emitido`, `anulado`, `devuelto` | `schema.prisma:247` |
| `OrigenTicket` | `pos`, `online` | `schema.prisma:252` |
| `TipoProductoVenta` | `simple`, `promo` | `schema.prisma:180` |
| `EstadoOrdenCocina` | `pending`, `preparing`, `ready`, `delivered` | `schema.prisma:324` |
| `EstadoMesa` | `libre`, `ocupada` | `settings/dto.ts:120,135` (`@IsIn`) |
| `EstadoCuentaEquipo` | `abierta`, `cerrada` | `settings/dto.ts:166,180` (`@IsIn`) |
| `EstadoPedidoPublico` | `pendiente_pago`, `pagado`, `en_cocina`, `listo`, `retirado`, `cancelado` | `schema.prisma:893` |
| `PlacementPatrocinador` | `banner`, `sidebar`, `footer` | `prisma/seeds/cantina.seed.cjs:20-48` |
| `TipoMedio` | `image`, `video` | `media/dto.ts:6,29` |
| `EstadoPartido` | `pendiente`, `jugado`, `suspendido`, `wo` | `schema.prisma:754` |
| `TipoEventoPartido` | `gol`, `asistencia`, `amarilla`, `roja`, `azul`, `doble_amarilla`, `expulsion_directa` | `schema.prisma:793` |
| `GeneroCategoria` | `hombres`, `mujeres` | `schema.prisma:470` |
| `RolPlantel` | `jugador`, `capitan`, `subcapitan` | `schema.prisma:649` |
| `RolCuentaPublica` | `usuario`, `seguidor`, `jugador`, `capitan` | `schema.prisma:600` |

**Se dejan como `String` a propósito**: `Medio.type` (ya cubierto por `TipoMedio` solo en el
DTO, la columna admite otros tipos de archivo a futuro), `Impresora.type`,
`Configuracion.scope` y `SesionConteo.dateType`. En estos cuatro no existe una lista
autoritativa en el código; convertirlos exigiría inventar valores, lo que agrega riesgo sin
corregir ningún bug observado.

**Consecuencia de `RolUsuario`:** desaparece la capa de alias heredados de
`src/common/roles.ts:32-53` (`LEGACY_ROLE_ALIASES`, `normalizeApiRole`). Los grupos de permisos
pasan a usar los valores del enum. Es una simplificación real del RBAC, pero cambia
comportamiento: cualquier usuario con rol `Gerente_Operaciones`, `Encargado_Stock`,
`Encargado_Futbol`, `Operador` o `Viewer` deja de existir y hay que re-seedearlo con el rol
canónico.

**Política de borrado (D6).** Se hace explícita en cada relación en lugar de depender del
`Restrict` implícito de Prisma. Corrige además la deriva del FK de auditoría, que declara
`onDelete: SetNull` en `schema.prisma:958` mientras la base sigue en `RESTRICT`.

**`CHECK` constraints.** En la migración de constraints:

- `niveles_stock.quantity >= 0`
- `tickets_venta.total >= 0`
- `items_ticket_venta.unitPrice >= 0` y `quantity > 0`
- `productos_venta.price >= 0`
- `pedidos_publicos.total >= 0`
- `items_pedido_publico.unitPrice >= 0` y `quantity > 0`
- `partidos_futbol`: `homeGoals >= 0` y `awayGoals >= 0` cuando no son nulos
- `cuentas_publicas`: al menos uno de `googleId` o `password_hash` no nulo

### Dominio stock / inventario

- Eliminar `LogConsumo` y `EntradaConsumo` (D2). `EntradaConsumo` nunca tuvo FK a producto ni a
  depósito: acepta IDs inexistentes. Su reemplazo, `ConsumoEmpleado`, sí los tiene.
- `Producto.unit` y `ConsumoEmpleado.unit` / `EntradaConteo.unit` pasan a `UnidadMedida`.
- **Corregir la pérdida de datos en el mapper del admin**: `inventory-mappers.ts:31` fuerza
  `unit` a `'kg' | 'unidades'`, así que un producto en `cajas` o `litros` se muestra como
  `unidades`. Se elimina la coerción y el selector de la UI pasa a ofrecer los cuatro valores.
- `MovimientoStock.type` pasa a `TipoMovimientoStock`.
- `OrdenCompra.status` pasa a `EstadoOrdenCompra`. La UI acepta además `'Confirmado'`
  (`OrdersPage.tsx:74`) mapeándolo a `Recibido`; es un valor heredado que no se persiste y se
  elimina del frontend.
- Índices faltantes en columnas de FK usadas para join: `ProveedorProducto.supplierId`,
  `OrdenCompra.supplierId`.

### Dominio ventas / POS

- `ProductoVenta.category` (string libre, default `"Comidas"`) se reemplaza por
  `categoriaVentaId` con FK a `CategoriaVenta` y `onDelete: Restrict` (D3). Hoy renombrar una
  categoría en `categorias_venta` deja a los productos apuntando al texto viejo.
- Enums: `TicketVenta.status`, `TicketVenta.origen`, `ProductoVenta.kind`,
  `OrdenCocina.status`, `MesaVenta.status`, `CuentaEquipo.status`.
- `MesaVenta.currentOrderId` pasa a ser un FK real a `TicketVenta` con `onDelete: SetNull`. Ya
  se le asigna un id de ticket en `VentasPosContext.tsx:310`, sin ninguna garantía de que exista.
- Eliminar `SalesService.findAllTables()` (`sales.service.ts:894-898`): consulta `depositos` y
  les inventa el estado `'libre'`. Es código muerto — ninguna ruta lo expone y el admin usa
  `/settings/tables`.
- `Impresora`: `@@unique([name])`. `MesaVenta`: `@@unique([name])`.

**No se cambia** `ItemTicketVenta.quantity`, `ItemOrdenCocina.quantity`,
`ItemComboVenta.quantity` ni `ItemPedidoPublico.quantity` de `Int` a `Decimal`. La revisión
inicial lo marcó como problema por simetría con las recetas, pero la cantidad de una línea de
venta es intrínsecamente entera: se venden 2 empanadas, no 2,5. Las recetas sí usan `Decimal`
porque miden gramos y litros. Cambiarlo agregaría precisión que nadie necesita.

### Dominio online / cantina

- Eliminar `ProductoOnline` y el módulo `online-catalog` completo (D2): controller, service,
  DTOs, módulo, su registro en `app.module.ts`, los métodos del cliente en
  `web-admin/src/app/api/client.ts` y `web-public/src/app/api/client.ts`, y sus referencias en
  `adapters.ts` de ambos frontends y en `test/unit/adapter-integration.test.ts`. Es una tienda
  online paralela sin integración con stock ni con el flujo de cantina, que hoy funciona con
  `productos_venta` + `categorias_web`.
- Enums: `PedidoPublico.status`, `Patrocinador.placement`, `Patrocinador.mediaType`.
- `Patrocinador`: `@@unique([name])`.

### Dominio fútbol

- Índices faltantes en columnas de FK: `PartidoFutbol.homeTeamId`, `PartidoFutbol.awayTeamId`,
  `EquipoInscripcion.equipoId`, `Campeonato.temporadaId`, `CategoriaConfig.grupoCanchasId`,
  `ProductoVentaFiltro.filtroWebId`, `ReglamentoArticulo.apartadoId`, `ReglamentoRegla.anexoId`.
- `Suspension.origenPartidoId`: pasa a FK real a `PartidoFutbol` con `onDelete: SetNull`, más su
  índice. Hoy es un string suelto.
- `Persona.email`: pasa a `@unique`. Hoy está indexado pero admite duplicados, y el login
  público resuelve cuentas por email.
- `InscripcionJugador`: `@@unique([equipoInscripcionId, numeroCamiseta])` para que no haya dos
  jugadores con la misma camiseta en el mismo equipo.
- Enums: `PartidoFutbol.status`, `EventoPartido.tipo`, `CategoriaConfig.genero`,
  `InscripcionJugador.rolPlantel`, `CuentaPublica.rol`.

### Dominio auditoría / configuración

- `Usuario.role` pasa a `RolUsuario`, con la eliminación de la capa de alias descrita arriba.
- `EntradaAuditoria.user`: el `onDelete: SetNull` declarado pasa a estar realmente aplicado en
  la base al regenerarse la baseline.

## Manejo de errores

Se agrega un filtro de excepciones global de Nest,
`apps/api/src/common/prisma-exception.filter.ts`, registrado en `main.ts`, que traduce
`Prisma.PrismaClientKnownRequestError`:

| Código | Significado | Respuesta HTTP |
|---|---|---|
| `P2002` | violación de constraint único | `409 Conflict` |
| `P2003` | violación de clave foránea | `400 Bad Request` |
| `P2025` | registro no encontrado | `404 Not Found` |

El filtro es la red de seguridad centralizada; no reemplaza los mensajes de dominio que ya
lanzan `ConflictException` con texto específico. `src/common/prisma-errors.ts` se amplía con
`isPrismaForeignKeyViolation` y `isPrismaRecordNotFound` junto al `isPrismaUniqueConflict`
existente, y `sales.service.ts:29-31` deja de tener su copia local del chequeo de `P2002`.

Los `catch` desnudos que enmascaran cualquier error como conflicto de unicidad
(`football.service.ts:217-229` y `264-274`) pasan a discriminar por código: si no es `P2002`,
el error se propaga.

## Seeds

Se separan en dos entradas (D7):

- **Referencia** (`prisma/seed.cjs`, siempre): categorías de stock, depósitos, cocinas, usuario
  admin, contadores de ticket y pedido, configuración de canchas y franjas, reglamento,
  categorías de venta. Estrictamente idempotente: `upsert` por clave natural, y **nunca** toca
  la contraseña de un usuario que ya existe.
- **Demo** (`prisma/seed-demo.cjs`, opcional vía `npm run prisma:seed:demo`): inventario de
  ejemplo, cantina, torneo de prueba, cuentas públicas, pedidos online, usuarios demo.

Correcciones de idempotencia:

- `users-demo.seed.cjs:17-19` y `public-accounts.seed.cjs:18-46` re-hashean y sobrescriben
  contraseñas en cada corrida. Pasan a hashear solo al crear.
- `online-demo.seed.cjs:93-110` crea un ticket con `number: contador + 50` sin incrementar el
  contador, lo que puede violar la constraint única de `tickets_venta.number`. Pasa a reservar
  el número incrementando `ContadorTicket`.
- Se elimina `prisma/seed.ts`, obsoleto: le faltan tres de los seeds que sí invoca `seed.cjs`,
  que es el que realmente se ejecuta.

## Comando de reconciliación

`apps/api/scripts/reconcile-stock.mjs`, expuesto como `npm run db:reconcile`. Solo **reporta**,
no corrige, y termina con código de salida distinto de cero si encuentra deriva:

1. Por cada `(productId, warehouseId)`, compara `niveles_stock.quantity` contra la suma de
   `movimientos_stock.quantity` del mismo par.
2. Por cada ticket, compara `tickets_venta.total` contra la suma de
   `items_ticket_venta.unitPrice * quantity`.

Que solo reporte es intencional: corregir automáticamente escondería el bug del backend que
produjo la deriva, que es justamente lo que el proyecto B tiene que arreglar.

## Testing

El problema con la suite actual es que `test/integration/` **no** usa una base de datos: usa
`createPrismaMock` de `test/helpers/stock-test-store.ts`. Un mock siempre acepta lo que le
mandes, así que no puede verificar ninguna restricción.

Se agrega una categoría de tests nueva, contra el PostgreSQL real de `docker-compose.yml`:

- Ubicación: `apps/api/test/db/`
- Config propia: `apps/api/vitest.db.config.ts`, para que la suite por defecto siga corriendo
  sin base de datos.
- Base separada: `lch_stock_test`, en la misma instancia de Postgres.
- Script de reset: `apps/api/scripts/reset-test-db.mjs`, que apunta `DATABASE_URL` a la base de
  test y corre `prisma migrate reset --force --skip-seed`.
- Comando: `npm run test:db`.

Cada test intenta escribir datos inválidos y afirma que la base los rechaza: FK inexistente,
enum con valor inventado, cantidad de stock negativa, email de persona duplicado, dos jugadores
con la misma camiseta, cuenta pública sin ningún método de autenticación, borrado de una
categoría con productos.

Chequeo de deriva: `npm run db:drift`, que corre
`prisma migrate diff --from-migrations --to-schema-datamodel --exit-code` contra una base
shadow, y falla si el schema y las migraciones no coinciden.

## Criterios de aceptación

1. `prisma/migrations/` contiene exactamente dos carpetas: la baseline generada y la de
   constraints.
2. `npm run db:drift` sale con código 0.
3. `npx prisma migrate reset --force` seguido de `npm run prisma:seed` funciona en una base
   vacía, y correrlo dos veces seguidas no cambia ninguna contraseña ni viola constraints.
4. `npm run test:db` pasa, e incluye al menos un test de rechazo por cada tipo de restricción
   agregada (FK, enum, `CHECK`, único).
5. `npm test` pasa en los tres workspaces.
6. `npm run build` pasa en `apps/api`, `apps/web-admin` y `apps/web-public`.
7. Ningún archivo del repo referencia `ProductoOnline`, `online-catalog`, `LogConsumo`,
   `EntradaConsumo` ni `findAllTables`.
8. `npm run db:reconcile` sale con código 0 sobre una base recién seedeada.

## Fuera de alcance

- Transacciones partidas, carreras de stock, bloqueo optimista, paginación y agregación en SQL
  (proyecto B).
- Eliminación del localStorage-first del admin, invalidación de caché y errores visibles al
  guardar (proyecto C).
- Rediseño de la UI, virtualización de listas, o cualquier cambio visual más allá del selector
  de unidades.
- Login lockout y SSE en memoria, que no escalan a múltiples instancias (proyecto B).
