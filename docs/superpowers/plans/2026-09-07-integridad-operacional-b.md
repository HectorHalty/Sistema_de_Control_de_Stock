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

- [x] **Task 4: SSE de cocina vía Postgres `LISTEN/NOTIFY`**
  - `sse.service.ts` mantiene el `Map` local para las conexiones abiertas de
    *esa* instancia (sigue haciendo falta), pero `broadcastKitchenEvent` ya
    no escribe directo a `this.clients`: publica con `pg_notify` en el canal
    `kitchen_events`, y cada instancia (incluida la que lo emitió) lo recibe
    por `LISTEN` y entrega a sus propios clientes — un solo camino de
    entrega, sin duplicar.
  - Dependencia nueva: `pg` (Prisma no expone `LISTEN/NOTIFY`). Conexión
    dedicada abierta en `onModuleInit`, cerrada en `onModuleDestroy`.
  - Degradación explícita: si `DATABASE_URL` falta o la conexión de `LISTEN`
    falla al arrancar, cae a entrega sólo local (mismo comportamiento que
    antes de esta tarea) en vez de romper el arranque de la API — mismo
    criterio que ya usa `PrismaService.onModuleInit`.
  - Test nuevo `test/db/sse-cross-instance.test.ts`: dos `SseService` reales
    contra Postgres — un evento emitido en la instancia A llega a un cliente
    conectado en la instancia B, y el filtro por `kitchenId` se respeta
    también entre instancias. 2/2 verde.
  - `npm test` (209/209) y `npm run test:db` (53/53) en verde.

- [x] **Task 5: Investigación de agregación en SQL — cierra sin cambios de
  código**
  - `reglamento-engine.service.ts`: `getStandingsForTorneo` trae inscripciones
    y partidos de un torneo y llama `computeStandings`, que aplica reglas
    configurables (`criteriosDesempate`, puntaje por victoria/empate/derrota)
    para armar la tabla de posiciones. Es lógica de negocio con criterios de
    desempate parametrizables — llevarla a SQL significaría hardcodear esas
    reglas en la base, perdiendo la flexibilidad de tenerlas en
    `reglamento.engine.ts`.
  - `getYellowCardSuspensions` sí hace un conteo simple
    (`countYellowCardsByPerson`) que técnicamente podría ser un `groupBy` de
    Prisma — pero opera sobre los eventos de un solo torneo.
  - `suspension-sync.service.ts`: recalcula sanciones y acumulación de
    amarillas por torneo en cada cambio de evento. Es lógica secuencial con
    estado (orden de partidos, historial de acumulación), no una agregación
    plana — un `groupBy` no reemplaza este cálculo.
  - Volumen real: no se pudo medir contra datos de producción (la base de
    desarrollo estaba vacía al momento de esta tarea). Estimado por dominio:
    una liga amateur de fútbol 5/11 corre con ~10-16 equipos por torneo,
    ~90-240 partidos por temporada y unos pocos eventos (goles+tarjetas) por
    partido — del orden de cientos a ~2000 filas por torneo, no miles. A esa
    escala, traer las filas a Node y recorrerlas una vez no es un problema de
    rendimiento real.
  - **Conclusión:** no amerita tarea de refactor a SQL. Si el volumen crece
    varios órdenes de magnitud (ligas nacionales, múltiples temporadas
    simultáneas), revisar de nuevo — hasta entonces, cierra sin diff.

- [x] **Task 6: Bloqueo optimista — esquema**
  - Campo `version Int @default(0)` agregado a `Producto`, `ProductoVenta`,
    `OrdenCompra`, `Configuracion`. Migración regenerada (`db:baseline`),
    `db:drift` en 0.
  - `npm run test:db` 53/53 en verde contra el esquema nuevo.

- [x] **Task 7: Bloqueo optimista — backend**
  - Helper compartido `common/optimistic-lock.ts`
    (`assertVersionedUpdateApplied`): un `updateMany` condicionado por
    `{ id, version }` es una sola sentencia SQL atómica, no hace falta
    `SELECT ... FOR UPDATE` aparte. `count === 0` → 409 con mensaje claro.
  - `version` es **opcional** en los 4 DTOs (`UpdateProductDto`,
    `UpdateSalesProductDto`, `UpdatePurchaseOrderDto`, `UpsertConfigDto`):
    mientras el admin no la mande (Task 8), el update sigue el camino viejo
    sin chequeo — rollout no disruptivo.
  - `stock.service.ts` (`updateProduct`, `updatePurchaseOrder`),
    `sales.service.ts` (`updateSalesProduct`), `settings.service.ts`
    (`upsertConfig`, reescrito a mano porque `upsert` no admite condicionar
    la rama de `update` por versión).
  - Ajustados los mocks de `test/helpers/stock-test-store.ts`
    (`producto`/`ordenCompra`: `findUnique` con `include`, `updateMany`
    versionado) para que la suite de siempre siguiera pasando.
  - Test nuevo `test/db/optimistic-lock.test.ts` contra Postgres real: dos
    ediciones concurrentes con la misma versión (una gana, la otra 409, sin
    mezclar datos), un update sin `version` no chequea nada, y el caso de
    `Configuracion` (versión vieja en registro existente → 409; primera vez
    con versión 0 → crea sin conflicto). 4/4 verde.
  - `npm test` 209/209, `npm run test:db` 57/57.

- [x] **Task 8: Bloqueo optimista — frontend admin (Producto, ProductoVenta,
  OrdenCompra; Configuracion queda documentado como pendiente)**
  - El 409 ya se mostraba legible sin cambios: `formatApiErrorMessage`
    (`app/api/client.ts`) cae al mensaje de texto plano del backend cuando no
    matchea ninguno de sus casos especiales — el mensaje de
    `assertVersionedUpdateApplied` llega tal cual al operador.
  - `version` agregado a los tipos locales (`Product`, `Order`,
    `SalesProduct` en `features/*/types.ts`) y a los mappers API→local
    (`inventory-mappers.ts`, `sales-mappers.ts`), y enviado de vuelta en los
    tres flujos de edición: `updateProduct`, `updatePurchaseOrder` (incluido
    el hilo hasta `OrdersPage.tsx`), `updateSalesProduct`.
  - **Configuracion queda sin wiring de `version` en el frontend.** El
    backend ya lo soporta (Task 7), pero `persistRemoteConfig` (usado por
    fútbol/stock/online/ventas) es un guardado fire-and-forget/debounced
    sobre un blob de configuración por pantalla, no un formulario
    cargar-editar-guardar como los otros tres — versionarlo bien requiere
    rastrear la versión por clave en cada una de las 4 pantallas que lo usan,
    que es más superficie de cambio de la prevista en "4 formularios". Queda
    como pendiente explícito, no como bug.
  - `npm test` de `web-admin` 171/171 en verde, `npm run build` compila sin
    errores nuevos.

- [x] **Task 9: Paginación por cursor — backend**
  - Helper compartido `common/pagination.ts` (`normalizeLimit`,
    `toCursorPage`): pide `take: limit + 1`, si vino de más hay próxima
    página y el cursor es el `id` de la última fila devuelta.
  - Convertidos: `findAllProducts`, `findAllSuppliers`,
    `findAllPurchaseOrders` (`stock.service.ts`), `findAllOrders`
    (`kitchen.service.ts` — el listado sin filtro de `status`, historial sin
    límite; `getActiveOrdersForKitchen` queda igual, ya está acotado por
    `status != delivered`), `findAllTickets` (`sales.service.ts` — hoy
    `take: 100` fijo sin `skip`/`cursor`).
  - **Compatibilidad hacia atrás por diseño:** sin `cursor` ni `limit` en la
    query, cada endpoint devuelve el array completo de siempre (mismo
    contrato que antes). Con cualquiera de los dos, devuelve
    `{ items, nextCursor }`. Los controllers exponen `?cursor=&limit=` como
    query params opcionales.
  - `orderBy` de cada listado ahora incluye `id` como desempate (ej.
    `[{name:'asc'},{id:'asc'}]`) — Prisma necesita esto para que el cursor dé
    un orden estable entre páginas.
  - Overloads explícitos en cada servicio (tipos `ProductWithLevels`,
    `SupplierWithProducts`, `PurchaseOrderWithItems`, `TicketWithItems`,
    `KitchenOrderWithDetails` vía `Prisma.*GetPayload`) para que TS siga
    infiriendo `T[]` en los callers que no piden paginación, en vez de la
    unión `T[] | CursorPage<T>` en todos lados.
  - No se tocaron los catálogos chicos de `settings.service.ts` (mesas,
    impresoras, configuración) — siguen sin límite, no mostraron evidencia
    de crecer.
  - Test nuevo `test/db/pagination.test.ts` contra Postgres real: sin
    cursor/limit devuelve el array completo; con `limit` da la primera
    página + `nextCursor`; recorrer con `nextCursor` trae todas las filas
    sin repetir ni saltear; la última página no trae `nextCursor`. 4/4 verde.
  - `npm test` 209/209, `npm run test:db` 61/61.

- [x] **Task 10: Paginación por cursor — frontend admin — bloqueada por
  arquitectura, no implementada; hallazgo documentado**
  - Los 5 listados tocados en la Task 9 (`hydrateProducts`, `hydrateSuppliers`,
    `hydrateOrders`, `hydrateTickets`/POS, cocina) siguen **un mismo patrón en
    toda la app**: al montar, `use-inventory-state.ts`/`use-sales-state.ts`
    traen la lista **completa** del servidor a estado local (y de ahí a
    `localStorage`), y cada mutación hace un update optimista local +
    re-hidratación completa en background (`scheduleBackgroundHydrate`). No
    existe ninguna pantalla de "lista paginada" en el admin — todas asumen
    tener el dataset entero en memoria (búsquedas, `.find()`, conteos por
    depósito, agrupaciones para el dashboard).
  - Agregar un "cargar más" real implicaría que esas pantallas dejen de tener
    el dataset completo — rompería cualquier `.find()`/agregación que hoy
    asume "tengo todo". Eso no es un ajuste de UI menor: es tocar el mismo
    patrón localStorage-first/hidratación completa que **Proyecto C**
    (fuera de alcance de este plan, ver spec) existe para resolver.
  - Decisión: no forzar el cambio en Plan B. El backend (Task 9) es seguro y
    compatible hacia atrás — no rompe nada hoy, y queda listo para cuando
    Proyecto C rediseñe la capa de hidratación del admin y pueda consumir
    `cursor`/`nextCursor` de verdad.
  - Sin diff de frontend en esta tarea.

- [x] **Task 11: Documentación y cierre**
  - `docs/RUNBOOK.md` actualizado: lockout de login en Postgres (sección
    Auth + Known Limitations), canal `LISTEN/NOTIFY` de SSE y su
    degradación, contrato de paginación por cursor (`?cursor=&limit=`,
    `{ items, nextCursor }`) y qué endpoints lo soportan, bloqueo optimista
    (`version`) y qué entidades/formularios lo usan hoy.
  - `db:drift` en 0. `npm test` 209/209. `npm run test:db` 61/61 (contra
    Postgres real, migraciones `baseline` + `constraints` aplicadas desde
    cero en cada corrida).

## Estado final

Las 7 áreas del spec quedaron resueltas o documentadas explícitamente:

| Tema | Resultado |
|---|---|
| Transacciones partidas | Auditoría limpia (Task 1) |
| Carreras de stock (online/kitchen) | Auditoría limpia (Task 2) |
| Login lockout en memoria | Resuelto — Postgres (Task 3) |
| SSE en memoria | Resuelto — `LISTEN/NOTIFY` (Task 4) |
| Agregación en SQL | Investigado, no amerita cambio (Task 5) |
| Bloqueo optimista | Backend completo, frontend 3/4 (Tasks 6-8) |
| Paginación | Backend completo y compatible; frontend bloqueado por arquitectura (Tasks 9-10) |

Pendientes explícitos que quedan fuera de esta rama, no perdidos:
- `Configuracion.version` sin wiring en `persistRemoteConfig` (Task 8).
- Paginación sin consumir en el admin — depende de que Proyecto C rediseñe
  la hidratación local-first (Task 10).
- Auditoría de agregación SQL a revisar de nuevo si el volumen de datos de
  fútbol crece varios órdenes de magnitud (Task 5).

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
