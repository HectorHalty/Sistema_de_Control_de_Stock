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

- [ ] **Task 1: Auditoría de `$transaction` existentes (transacciones
  partidas)**
  - Recorrer cada `$transaction` en `apps/api/src` (sales, stock, public,
    online, kitchen, football) y documentar en una tabla: qué I/O externo
    (SSE, impresión, email) queda afuera vs. adentro, y si algo que debería
    revertir con la DB queda afuera.
  - Confirmar el caso ya identificado en el spec:
    `public-orders.service.ts:86-101` emite SSE después del `$transaction`
    — documentar que es correcto (un fallo de SSE no debe revertir una
    venta), no "arreglarlo".
  - Si aparece un caso real de operación fuera de transacción que debería
    estar adentro, corregirlo acá mismo.
  - Salida: tabla de auditoría en el report de la tarea. Si no aparece nada
    para corregir, la tarea cierra como auditoría limpia, sin diff de código
    de negocio.

- [ ] **Task 2: Auditoría de carreras de stock en `online` y `kitchen`**
  - Confirmar si `online.service.ts` y `kitchen.service.ts` tocan
    `nivelStock` directamente en algún `$transaction` sin `FOR UPDATE`, o si
    sólo mueven estado propio (pedidos, órdenes de cocina) y por lo tanto no
    hay carrera de stock real.
  - Si hay un camino real sin lock: aplicar el mismo patrón de
    `stock.service.ts:122-124` (`SELECT ... FOR UPDATE` sobre `niveles_stock`
    antes de leer y actualizar).
  - Agregar un test de integración que ejercite dos ajustes/checkouts
    concurrentes sobre el mismo producto y confirme que no queda stock
    negativo ni se pierde un movimiento.

- [ ] **Task 3: Lockout de login en Postgres**
  - Nueva tabla (o campos en `Usuario`) para intentos fallidos: usuario,
    conteo, timestamp del último intento. Decisión de la spec: Postgres, no
    Redis.
  - Reemplazar el `Map` en memoria de `auth.service.ts:13` por lectura/
    escritura a esa tabla, dentro de una transacción corta para evitar
    condiciones de carrera en el propio contador (dos intentos fallidos
    simultáneos no deben perderse entre sí).
  - Mantener la ventana de 15 minutos y el máximo de 5 intentos ya existentes
    (`MAX_LOGIN_ATTEMPTS`, `LOCKOUT_WINDOW_MS`) — no se está pidiendo cambiar
    la política, sólo dónde vive el contador.
  - Test: dos "instancias" simuladas (dos `AuthService` con el mismo
    `PrismaService`) deben compartir el lockout.
  - Actualizar `docs/RUNBOOK.md` si documenta el comportamiento actual del
    lockout.

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
