# Proyecto B — Integridad operacional — Diseño

Borrador inicial. No pasó todavía por el proceso de revisión que tuvo el spec de
Plan A (`2026-09-06-integridad-esquema-bd-design.md`). Alcance definido en ese
spec, sección "Fuera de alcance":

> Transacciones partidas, carreras de stock, bloqueo optimista, paginación y
> agregación en SQL (proyecto B). [...] Login lockout y SSE en memoria, que no
> escalan a múltiples instancias (proyecto B).

## Problema

El sistema corre hoy en una sola instancia de API y con tráfico bajo, así que
varios atajos no duelen todavía. Pero hay puntos concretos donde el código
asume una sola instancia de proceso, o deja ventanas de carrera sin cerrar, o
devuelve listas sin límite real. Cualquiera de esos tres supuestos se rompe si
el negocio crece (más de una instancia de API, más operadores concurrentes, o
simplemente más filas por tabla con el tiempo).

## Contexto y descomposición

Investigación puntual sobre `apps/api/src` (rama `main`, commit `87bbd6a`).
Se agrupa en 7 hallazgos, todos catalogados como Proyecto B en el spec de
Plan A:

1. Login lockout en memoria de proceso.
2. SSE (Server-Sent Events) de cocina en memoria de proceso.
3. Carreras de stock — parcialmente ya resuelto, hay que verificar cobertura.
4. Transacciones partidas — mismo caso: parcialmente ya resuelto.
5. Falta de bloqueo optimista en entidades editadas desde el admin.
6. Paginación real (cursor/offset) ausente en listados.
7. Agregación en SQL ausente — cálculos que hoy se hacen trayendo filas a JS.

## Restricciones del contexto

- El sistema sigue en desarrollo activo; no hay usuarios en producción todavía
  que dependan de comportamiento actual del lockout o del SSE.
- No hay Redis ni ningún store compartido entre instancias hoy. Introducir uno
  es una decisión de infraestructura, no solo de código — hay que confirmarla
  antes de escribir el plan detallado.
- Postgres ya se usa con `SELECT ... FOR UPDATE` en el flujo de venta
  (`sales.service.ts`) y en ajuste manual de stock (`stock.service.ts:122`).
  Es el patrón a reutilizar, no algo que inventar de cero.
- `prisma migrate diff` no modela `CHECK` — ya documentado en Plan A — así que
  cualquier constraint nueva (ej. optimistic lock) debe seguir esa misma regla
  de contingencia si aplica.

## Hallazgos por tema

### 1. Login lockout en memoria (`apps/api/src/auth/auth.service.ts:12-13`)

```ts
// In-memory attempt tracker (use Redis in production)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
```

El propio comentario admite el problema. Con más de una instancia de API
detrás de un balanceador, el contador de intentos fallidos se reparte entre
procesos: un atacante puede reintentar sin nunca acumular 5 intentos en la
misma instancia. También se pierde en cada restart/deploy.

**Opciones a decidir en el plan:**
- Mover el contador a Postgres (tabla `intento_login` o campo en `Usuario`)
  en vez de sumar una dependencia nueva (Redis) para un solo caso de uso.
- Si se agrega Redis por el punto 2 (SSE), reusarlo acá tiene sentido.

### 2. SSE de cocina en memoria (`apps/api/src/sse/sse.service.ts:15-58`)

```ts
private clients = new Map<string, SseClient>();
```

Cada conexión SSE de cocina vive en el `Map` de la instancia que la aceptó.
`broadcastKitchenEvent` sólo notifica a los clientes conectados a esa misma
instancia. Con dos instancias de API, una orden creada en la instancia A no
llega a un cliente de cocina conectado a la instancia B.

**Opciones a decidir en el plan:**
- Redis Pub/Sub (o Postgres `LISTEN/NOTIFY`, ya disponible sin dependencia
  nueva) para redistribuir el evento a todas las instancias.
- Alternativa más simple si no se justifica la infraestructura todavía:
  documentar el límite y exigir *sticky sessions* / instancia única para SSE
  hasta que haga falta escalar.

### 3. Carreras de stock — estado real

Ya resuelto en los dos caminos críticos:
- `stock.service.ts:122-124` usa `SELECT ... FOR UPDATE` antes de leer y
  actualizar `nivelStock`.
- `sales.service.ts` (checkout y reversas) también usa `FOR UPDATE` sobre
  `tickets_venta` y sobre los niveles de stock antes de llamar
  `allocateDeduction` (`sales-stock.ts:73-117`), que es una función pura sin
  I/O — el locking pasa por el caller, no por ella.
- `public-orders.service.ts` delega el checkout a `sales.service.ts`, así que
  hereda el mismo locking.

**Pendiente de verificar (no confirmado como bug, sí como hueco de
cobertura):** `online.service.ts` y `kitchen.service.ts` tienen sus propios
`$transaction`, pero no aparecieron con `FOR UPDATE` en la búsqueda inicial.
Hay que revisar si esos caminos tocan `nivelStock` directamente o sólo estado
propio (pedidos, órdenes de cocina) — si es lo segundo, no hay carrera de
stock ahí y el ítem se cierra sin cambios de código.

### 4. Transacciones partidas — estado real

Los flujos de negocio principales (venta, ajuste de stock, checkout público)
ya envuelven sus pasos en `$transaction`. No se encontró un caso confirmado de
un flujo de venta o stock que quede a mitad de camino ante un error. El
trabajo de este ítem es más bien una auditoría dirigida — recorrer cada
`$transaction` existente y confirmar que:
- No hay operaciones fuera de la transacción que deberían estar adentro
  (ej. el broadcast SSE de `public-orders.service.ts:86-101` corre *después*
  del `$transaction`, lo cual es correcto — un SSE no debe revertir con un
  rollback de DB, pero hay que confirmarlo caso por caso, no darlo por hecho).
- No hay `await` de I/O externo (impresión, email) adentro de un
  `$transaction`, que alargaría el lock innecesariamente.

### 5. Bloqueo optimista — ausente

`schema.prisma` no tiene ningún campo de versión (`version Int` o similar) en
ninguna tabla. Los `update` del admin (productos, proveedores, órdenes de
compra, configuración) son *last-write-wins*: si dos operadores editan el
mismo producto a la vez, gana el que guarda último sin aviso al primero.

**Alcance a decidir en el plan:** no tiene sentido versionar las 63 tablas.
Hay que elegir cuáles lo justifican — candidatas por volumen de edición
concurrente: `Producto`, `ProductoVenta`, `OrdenCompra`, `Configuracion`.

### 6. Paginación — ausente en la mayoría de los listados

Patrón repetido: `findMany` sin `take`/`cursor`, o con un `take` fijo sin
forma de pedir la página siguiente:

- `stock.service.ts:25` (`findAllProducts`) — sin límite.
- `stock.service.ts:282` (`findAllSuppliers`) — sin límite.
- `stock.service.ts:340` (`findAllPurchaseOrders`) — sin límite.
- `settings.service.ts` — catálogos (`findMany` de configuración, mesas,
  impresoras) sin límite; aceptable mientras sean catálogos chicos, pero sin
  garantía de que se mantengan así.
- `sales.service.ts:791` (`findAllTickets`) — `take: 100` fijo, **sin**
  `skip`/`cursor`: no hay forma de ver tickets más viejos que los últimos 100
  filtrando por estado/operador.
- `kitchen.service.ts:25,88` — listados de órdenes de cocina sin límite.

**Ya tienen límite correcto (referencia, no tocar):** `stock.service.ts:242`
(`consumoEmpleado`), `:272` (`sesionConteo`) — usan `take: limit` configurable.

### 7. Agregación en SQL — ausente

No se relevó todavía ningún reporte/endpoint puntual que traiga todas las
filas a Node para sumar/promediar en JS (el grep de `findMany` no distingue
eso de listados simples). Este ítem queda pendiente de una pasada dedicada
sobre `reglamento-engine.service.ts` y `suspension-sync.service.ts` — ambos
traen listas completas de eventos/partidos por torneo y recorren en JS
(`findMany` sin `select` de agregado). Con torneos de temporada completa esto
puede ser cientos de filas, no miles — a confirmar si amerita `groupBy`/
`aggregate` de Prisma antes de escribirlo en el plan como tarea obligatoria.

## Decisiones tomadas

1. **Store compartido: Postgres, no Redis.** Lockout de login vía tabla nueva
   (`IntentoLogin` o campo en `Usuario`); redistribución de eventos SSE entre
   instancias vía `LISTEN/NOTIFY`. Sin dependencia de infraestructura nueva.
2. **Paginación: cursor, no offset.** Se pagina por `id` (o `createdAt` +
   `id` como desempate) en vez de `skip`. Implica tocar el admin para pasar
   de "traer todo" a "pedir la próxima página", no solo el backend.
3. **Agregación en SQL: se investiga dentro de este plan.** Una tarea
   temprana revisa `reglamento-engine.service.ts` y
   `suspension-sync.service.ts` y decide ahí si hace falta `groupBy`/
   `aggregate` de Prisma o si se cierra sin cambios de código.
4. **Bloqueo optimista — alcance cerrado a 4 tablas:** `Producto`,
   `ProductoVenta`, `OrdenCompra`, `Configuracion`. Son las editadas desde el
   admin con mayor chance de choque entre dos operadores. Se confirma (o
   ajusta) al arrancar la tarea correspondiente del plan, no se abre a
   discusión por cada tabla del esquema.

## Fuera de alcance

- Proyecto C (localStorage-first del admin, invalidación de caché, errores
  visibles al guardar).
- Cualquier cambio de UI del admin más allá de lo estrictamente necesario
  para consumir paginación real (ej. controles de "página siguiente").
- Migrar a un motor de colas o *message broker* completo — si hace falta
  redistribuir eventos SSE, la primera opción a evaluar es Postgres
  `LISTEN/NOTIFY`, no una cola nueva.
