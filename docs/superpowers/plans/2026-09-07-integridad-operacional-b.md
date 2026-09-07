# Plan — Proyecto B: Integridad operacional

Spec: `docs/superpowers/specs/2026-09-07-integridad-operacional-b-design.md`
Rama sugerida: `feat/integridad-operacional-b`
Rama base: `main` (o el estado de `feat/integridad-esquema-bd` una vez
mergeado, si Plan A no terminó todavía — confirmar al arrancar Task 0).

## Notas generales

- El sistema está solo en desarrollo: no hay usuarios en producción que
  dependan del lockout o del SSE actuales. Cambiar su comportamiento no es un
  riesgo de negocio, es una mejora esperada.
- Cada tarea sigue el mismo patrón que Plan A: brief → implementación →
  review package → report, con `npm test` en verde antes de cerrar.
- Ningún cambio de esquema se edita a mano en `prisma/migrations/`; se
  regenera con las mismas herramientas que dejó Plan A
  (`scripts/generate-baseline.mjs`, `db:drift`).

## Tareas

- [x] **Task 0: Confirmar base y crear la rama**
  - Plan A (`feat/integridad-esquema-bd`) tiene su implementación completa
    (25 commits cubriendo cada dominio del plan, `prisma/migrations/` con
    exactamente dos carpetas como exige su criterio de cierre) pero **no
    está mergeada a `main`** todavía — no se pudo confirmar si el Step 7 de
    su Task 11 (revisión final del diff) ya se hizo.
  - Decisión: ramear `feat/integridad-operacional-b` desde
    `feat/integridad-esquema-bd`, no desde `main`, para no esperar el merge.
    Rebasear cuando A se mergee.
  - Rama creada. Sin código de negocio en esta tarea.

- [x] **Task 1: Auditoría de `$transaction` existentes (transacciones
  partidas)** — auditoría limpia, sin cambios de código.
  - Recorridos: `sales.service.ts` (checkout, reversas), `stock.service.ts`
    (`adjustStock`), `public-orders.service.ts`, `online.service.ts`
    (filtros de producto, retiro por QR), `kitchen.service.ts`
    (`transitionOrder`), `football.service.ts` (recovery de jornada,
    actualización de partido).
  - `public-orders.service.ts:86-101` y `kitchen.service.ts:77-82` emiten
    SSE **después** del `$transaction` — correcto en ambos casos: un fallo
    de SSE no debe revertir una venta ni una transición de orden.
  - Impresión de tickets (`printing.service.ts`) es un controller aparte,
    invocado por el frontend después del checkout — nunca dentro de un
    `$transaction` del backend. No hay I/O externo lento adentro de ninguna
    transacción relevada.
  - No apareció ningún caso de operación fuera de transacción que debiera
    estar adentro. Cierra sin diff.

- [x] **Task 2: Auditoría de carreras de stock en `online` y `kitchen`** —
  confirmado que no hay carrera de stock, sin cambios de código.
  - `kitchen.service.ts:56-85` (`transitionOrder`): sólo lee/actualiza
    `ordenCocina.status` dentro del `$transaction`. No toca `nivelStock`.
  - `online.service.ts:338,489`: los dos `$transaction` tocan
    `productoVentaFiltro` y `tokenRetiroQR` — estado propio, no `nivelStock`.
  - El único camino que descuenta stock en checkout público es
    `public-orders.service.ts` → delega a `sales.service.ts`, que ya usa
    `SELECT ... FOR UPDATE` (auditado en Plan A / Task 1 de este plan).
  - No hace falta el test de concurrencia propuesto originalmente porque no
    hay código nuevo que lockear — ya está cubierto por los tests existentes
    de `sales.service.ts`.

- [x] **Task 3: Lockout de login en Postgres**
  - Tabla nueva `IntentoLogin` (`intentos_login`): `username` (PK),
    `count`, `lastAttempt`. Migración regenerada (`db:baseline`), `db:drift`
    en 0, migrada contra `lch_stock` y `lch_stock_test`.
  - `auth.service.ts` ya no usa el `Map` en memoria: lee/escribe
    `intentoLogin` con `upsert` atómico (`count: { increment: 1 }`), que no
    pierde intentos simultáneos sin necesitar un `$transaction` explícito
    (el `ON CONFLICT` de Postgres ya es atómico a nivel de fila).
  - Ventana de 15 minutos y máximo de 5 intentos sin cambios
    (`MAX_LOGIN_ATTEMPTS`, `LOCKOUT_WINDOW_MS`).
  - Test nuevo `test/db/auth-lockout.test.ts`: dos instancias de
    `AuthService` contra el mismo Prisma comparten el lockout (intentos
    repartidos entre "A" y "B" bloquean a ambas; login correcto resetea el
    contador para las dos). 2/2 verde contra Postgres real.
  - `npm test` (209/209) y `npm run test:db` (51/51) en verde.

- [ ] **Task 4: SSE de cocina vía Postgres `LISTEN/NOTIFY`**
  - Mantener el `Map` local en `sse.service.ts` para las conexiones abiertas
    de *esa* instancia (sigue haciendo falta: cada instancia mantiene sus
    propios sockets HTTP).
  - Agregar un listener a un canal de Postgres (`pg_notify` /
    `LISTEN kitchen_events`) para que `broadcastKitchenEvent` también
    redistribuya a las demás instancias, no sólo a `this.clients`.
  - Verificar el costo de una conexión dedicada de Postgres para `LISTEN`
    (Prisma no soporta `LISTEN/NOTIFY` nativamente — se necesita un cliente
    `pg` aparte o `prisma.$queryRaw` con una conexión persistente).
  - Test de integración: dos instancias del servicio SSE contra la misma DB,
    confirmar que un evento emitido en una llega a un cliente conectado en
    la otra.

- [ ] **Task 5: Investigación de agregación en SQL**
  - Revisar `reglamento-engine.service.ts` y `suspension-sync.service.ts`:
    ¿cuántas filas trae cada `findMany` en un torneo real (estimar con datos
    de seed o de producción si existen)? ¿el cálculo en JS es liviano
    (conteos, agrupaciones simples) o pesado?
  - Si el volumen no justifica cambiarlo: cerrar la tarea documentando por
    qué, sin tocar código.
  - Si lo justifica: mover el cálculo puntual a `groupBy`/`aggregate` de
    Prisma, empezando por el más costoso, no por los siete a la vez.

- [ ] **Task 6: Bloqueo optimista — esquema**
  - Agregar campo `version Int @default(0)` a `Producto`, `ProductoVenta`,
    `OrdenCompra`, `Configuracion` (confirmar la lista al arrancar, ver spec).
  - Migración aditiva, mismo patrón que Plan A: no se edita a mano el archivo
    de migración generado, `db:drift` en 0 al terminar.

- [ ] **Task 7: Bloqueo optimista — backend**
  - En cada `update` de las 4 entidades desde el admin: incluir `version` en
    el `where` y hacer `version: { increment: 1 }` en el `data`. Si el
    `update` no afecta ninguna fila (versión desactualizada), devolver 409
    con un mensaje claro ("Este registro fue modificado por otra persona,
    recargá y volvé a intentar").
  - Test: dos actualizaciones concurrentes con la misma versión de partida —
    una debe ganar, la otra debe recibir 409, ninguna debe perder datos
    silenciosamente.

- [ ] **Task 8: Bloqueo optimista — frontend admin**
  - El admin tiene que mandar la `version` que tenía al cargar el registro, y
    mostrar el error 409 de forma legible (no un toast genérico de "error").
  - Alcance mínimo: los 4 formularios que tocan las entidades de la Task 6/7.

- [ ] **Task 9: Paginación por cursor — backend**
  - Convertir a paginación por cursor (`id` + `createdAt` como desempate) los
    listados sin límite real identificados en la spec:
    `findAllProducts`, `findAllSuppliers`, `findAllPurchaseOrders`
    (`stock.service.ts`), listados de `kitchen.service.ts`, y
    `findAllTickets` (`sales.service.ts:791`, hoy `take: 100` fijo sin
    forma de pedir más).
  - Firma nueva: recibir `cursor?: string` y `limit?: number` (con default y
    tope máximo para no permitir `limit=999999`), devolver
    `{ items, nextCursor }`.
  - No tocar los catálogos chicos que hoy no tienen límite
    (`settings.service.ts`: mesas, impresoras, configuración) salvo que
    Task 9 revele que ya no son chicos.

- [ ] **Task 10: Paginación por cursor — frontend admin**
  - Adaptar las pantallas que consumen los endpoints de la Task 9 para pedir
    "página siguiente" en vez de asumir que la respuesta trae todo.
  - Alcance mínimo: sin rediseño visual, un control simple de "cargar más" o
    scroll infinito, lo que ya use el admin en otras listas si existe un
    patrón (revisar antes de inventar uno nuevo).

- [ ] **Task 11: Documentación y cierre**
  - `docs/RUNBOOK.md`: documentar el nuevo lockout basado en Postgres, el
    canal de `LISTEN/NOTIFY`, y el contrato de paginación por cursor.
  - `db:drift` en 0, `npm test` en verde, `progress.md` de esta serie
    (`.superpowers/sdd/`, gitignorado) cerrado.

## Riesgos que el plan deja explícitos

1. **`LISTEN/NOTIFY` con Prisma.** Prisma no expone esta API directamente;
   la Task 4 puede necesitar el driver `pg` en paralelo a Prisma, lo cual es
   una dependencia nueva aunque no sea "infraestructura" nueva (no hay
   servicio nuevo que levantar, sí una librería nueva en el código).
2. **Task 5 puede cerrar sin producir ningún cambio de código** — está bien,
   es una tarea de investigación explícita, no hay que forzar un refactor si
   el volumen de datos no lo justifica.
3. **Las Tasks 9/10 son las de mayor superficie de cambio en el admin** —
   tocan pantallas existentes de listado, no sólo agregan algo nuevo. Mayor
   chance de romper un flujo que ya funciona; conviene ir pantalla por
   pantalla con review, no todas juntas.

## Fuera de alcance

- Proyecto C (localStorage-first del admin, invalidación de caché, errores
  visibles al guardar) — spec y plan propios, a futuro.
- Redis o cualquier otro store externo — decisión tomada: Postgres alcanza.
- Bloqueo optimista en tablas fuera de las 4 listadas en la Task 6, salvo que
  esa misma tarea encuentre evidencia de que hace falta ampliar la lista.
