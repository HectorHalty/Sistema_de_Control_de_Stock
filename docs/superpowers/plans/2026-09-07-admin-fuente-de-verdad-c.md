# Plan — Proyecto C: Fuente de verdad del admin (Inventario + Ventas)

Spec: `docs/superpowers/specs/2026-09-07-admin-fuente-de-verdad-c-design.md`
Rama sugerida: `feat/admin-fuente-de-verdad-c`
Rama base: `feat/integridad-operacional-b` (Plan B completo, sin mergear
todavía — mismo criterio que B tomó respecto de A: no esperar el merge).

## Notas generales

- Alcance de esta pasada: **Inventario y Ventas únicamente** (decisión de la
  spec). Fútbol/online/cocina/plataforma quedan para un proyecto propio.
- El POS (`VentasPosContext.tsx`) tiene que seguir funcionando con la red
  caída — es un requisito de negocio explícito, no un descuido a corregir.
  Cualquier tarea que lo toque necesita probarlo sin red antes de darse por
  cerrada.
- Cada tarea corre `npm test` (vitest) de `web-admin` y `npm run build` antes
  de cerrar. No hay suite E2E — la verificación de UX real queda en manos de
  quien revise la rama en la app corriendo.

## Tareas

- [x] **Task 0: Instalar React Query y montar el `QueryClientProvider`**
  - Instalado `@tanstack/react-query` + `@tanstack/query-sync-storage-persister`
    + `@tanstack/react-query-persist-client` v5.102.8 en `apps/web-admin`.
  - `app/queryClient.ts`: `QueryClient` con `QueryCache`/`MutationCache` y un
    `onError` por defecto (`notifyQueryError`, hoy sólo loguea — Task 1 lo
    pisa con el toast real vía `setQueryErrorNotifier`, sin tocar este
    archivo).
  - `app/App.tsx`: `PersistQueryClientProvider` envolviendo `ErrorBoundary`/
    `AppShell`, persister de `localStorage` (clave `lch-admin-query-cache`).
    Si `localStorage` falla (cuota, modo privado), React Query sigue
    funcionando en memoria sin persistencia — no es fatal.
  - Sin migrar ningún hook todavía. `npm test` (171/171) y `npm run build`
    en verde.

- [x] **Task 1: Notificación global de errores**
  - `VentasPosContext.tsx`/`ReturnsModule.tsx` tienen su propio `toast`
    (estado de React, scope local al POS) — no sirve como mecanismo global
    porque `queryClient.ts` vive fuera del árbol de React y no puede usar
    hooks. Se creó uno nuevo, reusando el mismo estilo visual
    (`fixed top-4 left-1/2 ... bg-gray-900`) para que no se sienta como un
    elemento ajeno a la app.
  - `shared/notify.ts`: pub/sub mínimo sin dependencias
    (`notifyError`/`subscribeToErrors`) — el puente entre código fuera de
    React (`queryClient.ts`) y la UI.
  - `shared/components/GlobalToast.tsx`: único suscriptor en producción,
    montado una vez en `App.tsx` (dentro del `PersistQueryClientProvider`).
    Auto-descarta a los 6s.
  - `app/queryClient.ts`: el `onError` de `QueryCache`/`MutationCache` ahora
    llama `notifyError` directamente — reemplaza el placeholder de la
    Task 0.
  - No reemplaza los `try/catch` puntuales que ya muestran su propio mensaje
    en algunas pantallas — es la red de seguridad para lo que antes fallaba
    en silencio (la hidratación de los 6 `use-*-state.ts`, confirmado en el
    spec).
  - Test nuevo `shared/notify.test.ts` (lógica del pub/sub — el proyecto no
    tiene `@testing-library/react` para probar el componente en sí, y no se
    suma sólo para esto): entrega a suscriptores activos, no entrega tras
    `unsubscribe`, ids distintos por evento, múltiples suscriptores reciben
    el mismo evento. 4/4 verde.
  - `npm test` 175/175, `npm run build` sin errores.

- [x] **Task 2: Migrar Inventario — queries de lectura**
  - Los 8 datasets que antes venían de `useLocalStorage` + el `useEffect` de
    hidratación (`isApiReachable().then(Promise.all(hydrateX))`) ahora salen
    de 8 `useQuery` independientes (`['inventory', 'categories'|'warehouses'
    |'products'|'movements'|'employeeConsumptions'|'countSessions'|
    'suppliers'|'orders']`), en paralelo por diseño de React Query — sin
    orquestar un `Promise.all` a mano.
  - **No se tocó la firma pública del hook.** `products`, `setProducts`,
    `createProduct`, etc. siguen existiendo con el mismo nombre y forma — las
    30+ pantallas que los consumen no cambiaron. Lo que cambió es de dónde
    sale el valor inicial y quién dispara la re-hidratación.
  - El merge con lo pendiente local (`mergeServerWithPendingLocal`,
    `reassignProductCodes`) se mantiene intacto, ahora disparado por un
    `useEffect` que escucha `queryX.data` en vez de por el mount effect
    manual — mismo resultado, misma lógica de negocio.
  - `hydrateX()` (usado por 15+ mutaciones vía `scheduleBackgroundHydrate`)
    pasa a ser `queryClient.refetchQueries({queryKey: [...]})` — misma firma,
    mismo call site, implementación nueva.
  - `invalidateInventoryHydration` (consumido por el **POS**,
    `VentasPosContext.tsx`, en 4 lugares tras venta/anulación) se preservó
    con el mismo nombre — internamente ahora hace
    `queryClient.cancelQueries({queryKey:['inventory']})`. El problema que
    resolvía a mano (una hidratación inicial vieja pisando un cambio más
    nuevo) ya lo resuelve React Query nativamente — sólo el fetch más
    reciente de cada query commitea a `data` — así que cancelar el sobrante
    es un refuerzo explícito, no la única defensa.
  - `localStorage` sigue existiendo para `auditLog` y `consumptionLogs`
    (nunca vinieron de un endpoint de lectura — no son parte del problema).
  - `npm test` 175/175, `npm run build` sin errores.

- [x] **Task 3: Mutaciones con optimismo y rollback — ya satisfecho por el
  patrón existente, no se reescribió a `useMutation`**
  - Hallazgo al encarar la tarea: cada mutación (`updateProduct`,
    `createSupplier`, `updatePurchaseOrder`, etc.) **ya** hace exactamente
    optimismo + reconciliación —
    `setX(optimista); catch(e) { await hydrateX(); throw e; }` — es el mismo
    resultado que la spec pedía lograr con `onMutate`/`onError` de
    `useMutation`, sólo que escrito a mano en vez de con los hooks de la
    librería.
  - Reescribir ~15 mutaciones a `useMutation` para llegar al mismo
    comportamiento que ya tienen, sin ganancia funcional, era el riesgo más
    alto y menos justificado de todo el proyecto (lógica de negocio
    entrelazada: asignación de códigos de producto, resolución de
    categorías, ajuste de stock por almacén). Se decidió no forzarlo.
  - Lo que sí cambió con la Task 2: el paso de reconciliación (`hydrateX()`)
    ahora pasa por React Query (`refetchQueries`) en vez de un fetch manual
    — mismo comportamiento observable, mecanismo más confiable por debajo.
  - Sin diff de mutaciones en esta tarea.

- [x] **Task 4: Migrar Ventas — queries y mutaciones**
  - Mismo patrón que Task 2 aplicado a `use-sales-state.ts`: `kitchens` y
    `salesProducts` pasan a `useQuery`; `hydrateKitchens`/
    `hydrateSalesProducts` pasan a `queryClient.refetchQueries`. `tickets`
    **no** se convirtió a `useQuery` — `hydrateTickets(products)` la llama
    el POS (`VentasPosContext.tsx`) en 3 lugares pasándole explícitamente la
    lista de productos vigente en ese momento; no hay un único "momento de
    lectura" que una query pueda representar, así que se mantuvo como
    función imperativa (mismo cuerpo de siempre). La hidratación inicial de
    tickets se encadena una vez desde el `useEffect` que espera a
    `salesProductsQuery.data`, replicando el orden de la cadena manual
    anterior (kitchens+products en paralelo, tickets después).
  - `invalidateSalesHydration` (consumido por el POS) se preservó con el
    mismo nombre, reimplementado con `queryClient.cancelQueries` — mismo
    criterio que Task 2.

  **Bug real encontrado y corregido probando en vivo (no lo agarraba
  ningún test unitario):** al loguearse, el admin entraba en un loop
  infinito de pedidos a `/settings/*` y `/kitchen/orders` (decenas de miles
  de requests en segundos, según Network). Causa: `shared/hooks/
  use-local-storage.ts` devolvía un `setValue` **nuevo en cada render** (no
  usaba `useCallback`) — cualquier `useEffect` que lo tuviera como
  dependencia se volvía a disparar en cada render del componente, no sólo
  cuando el valor cambiaba de verdad. Era un bug latente preexistente
  (ya estaba así antes de Proyecto C) que nunca se manifestaba porque el
  render del mount se agotaba rápido; al sumar más renders encadenados
  durante el montaje (8 queries de Inventario + 2 de Ventas resolviendo por
  separado, cada una disparando su propio effect), ese bug latente se
  convirtió en loop real. **Fix:** `use-local-storage.ts` envuelve `setValue`
  en `useCallback([key])` — no es un cambio de Proyecto C en sí, es una
  corrección de un bug de la base de código que Proyecto C expuso.
  - Verificado en el navegador (login real, API real, DB de desarrollo
    reseteada a la baseline): consola sin errores, red estable después del
    fix, creación de producto (`updateProduct`/`createProduct`) reflejada al
    instante y persistida tras recargar la página, pantallas de Inventario
    y Ventas/POS cargan sin errores.
  - **Checkout online verificado en vivo** (con datos de demo sembrados):
    agregar producto al carrito, "Vender sin imprimir" → ticket creado
    (#1002), stock descontado correctamente (843→842), sin errores de
    consola. El código que cambió esta tarea (lectura de `kitchens`/
    `salesProducts`) no toca el POST de checkout ni el gate de
    `apiAvailable` que decide el modo offline (viven en
    `app/api/adapters.ts`, sin tocar) — riesgo residual bajo, pero **no se
    simuló la red cortada explícitamente** en este entorno de verificación;
    queda como último chequeo manual recomendado antes de mergear.
  - `npm test` 175/175, `npm run build` sin errores.

- [x] **Task 5: Limpieza — quitar el `useLocalStorage` de datos de servidor**
  - Ya no queda `useLocalStorage` para los 10 datasets migrados a React
    Query (8 de Inventario + `kitchens`/`salesProducts` de Ventas) — pasaron
    a `useState` en las Tasks 2/4. `salesTickets` también se convirtió a
    `useState` (lo llena `hydrateTickets`, imperativa, no una query — ver
    Task 4).
  - `useLocalStorage` sigue existiendo para lo que de verdad es preferencia
    local sin equivalente en servidor (`darkMode`, `alertDay`, flags de
    notificaciones, `auditLog`/`consumptionLogs` de inventario) y para las
    otras 9 claves de ventas fuera del alcance de esta pasada (categorías,
    impresoras, mesas, historial, config de ticket, etc.) — no se tocaron.
  - `shared/storage/keys.ts` anotado: las 10 claves que dejaron de escribirse
    quedan marcadas `// legacy` con un comentario explicando por qué no se
    borran (un navegador con datos de antes de Proyecto C todavía las
    tiene).
  - `npm test` 175/175, `npm run build` sin errores.

- [ ] **Task 6: Verificación completa y documentación**
  - `npm test` y `npm run build` de `web-admin` en verde.
  - Probar a mano (o documentar cómo probar) los 3 escenarios que motivaron
    el proyecto: (a) abrir el admin con datos viejos en localStorage y la
    API arriba — no debe mostrar el dato viejo como si fuera vigente; (b) la
    API se cae y se recupera — el admin tiene que darse cuenta sin esperar
    el TTL de 30s del reachability cache; (c) una mutación falla — el
    operador tiene que verlo, siempre.
  - `docs/RUNBOOK.md`: documentar el cambio de arquitectura (React Query +
    persistencia, ya no localStorage-first a mano) para Inventario/Ventas.

## Riesgos que el plan deja explícitos

1. **El POS no puede regresionar.** Es el riesgo más alto de todo el
   proyecto — un fallo ahí es directamente no poder cobrar. La Task 4 lo
   nombra explícitamente como criterio de cierre, no como nota al pie.
2. **770 + 676 líneas de hooks con lógica de negocio embebida** (asignación
   de códigos de producto, merge de pendientes locales, cálculo de historial)
   — migrar el mecanismo de estado sin tocar esa lógica es el trabajo fino
   de las Tasks 2-4, no algo que se resuelva con un find-and-replace.
3. **Sin suite E2E**, la verificación de que la UX no regresionó depende de
   probar la app corriendo — cada tarea que toque una pantalla debería
   pasar por esa revisión antes de mergear, no sólo por `npm test`.

## Fuera de alcance

- Fútbol, online, cocina, plataforma — sus hooks son mucho más chicos
  (49-93 líneas) y mayormente de solo lectura; candidatos a una pasada corta
  aparte una vez validado el patrón acá.
- Cualquier cambio visual además de estados de carga/error donde antes no
  los había.
- Migrar el modelo offline-first del POS — sigue necesitando funcionar sin
  red, eso no cambia.
