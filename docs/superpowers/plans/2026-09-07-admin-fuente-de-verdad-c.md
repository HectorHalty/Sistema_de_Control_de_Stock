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

- [ ] **Task 4: Migrar Ventas — queries y mutaciones**
  - Mismo patrón que Tasks 2/3 aplicado a `use-sales-state.ts`: productos de
    venta, tickets, historial.
  - **Cuidado explícito con el POS:** `VentasPosContext.tsx` consume este
    hook. Probar el flujo de checkout con la red cortada (DevTools offline o
    deteniendo el contenedor de la API) antes de cerrar la tarea — tiene que
    seguir pudiendo cobrar con el cache local disponible.

- [ ] **Task 5: Limpieza — quitar el `useLocalStorage` de datos de servidor**
  - Una vez migrados Inventario y Ventas, `useLocalStorage` (el hook a mano)
    deja de usarse para datos que vienen de la API en esos dos dominios.
    Sigue existiendo para preferencias puramente locales sin equivalente en
    servidor (`darkMode`, `alertDay`, flags de notificaciones) — no se toca
    eso.
  - Revisar `shared/storage/keys.ts`: las claves de inventario/ventas que
    dejan de usarse quedan documentadas como legacy (no se borran de
    entrada — usuarios con datos viejos en el navegador todavía las tienen;
    limpiarlas es un paso aparte, no de esta tarea).

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
