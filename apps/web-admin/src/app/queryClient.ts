/**
 * QueryClient central de React Query — Proyecto C
 * (docs/superpowers/plans/2026-09-07-admin-fuente-de-verdad-c.md).
 *
 * Reemplaza el patrón anterior de `useLocalStorage` + `useEffect` de
 * hidratación en los hooks de dominio (Task 0). `localStorage` deja de ser
 * la fuente de verdad inicial y pasa a ser sólo la caché de lectura offline
 * que persiste este cliente entre recargas — no algo que cada hook lea a
 * mano de forma síncrona.
 *
 * El aviso al operador (Task 1: `notifyError` → `<GlobalToast />`) sale de
 * `queryCache.subscribe` más abajo, NO del `onError` del constructor de
 * `QueryCache`. Dos hallazgos en vivo (Task 6) que motivan esto:
 *
 * 1. Con datos ya persistidos en caché, un refetch de fondo que falla
 *    mantiene la query en `status: 'success'` (React Query no pisa datos
 *    buenos con un error) — el `onError` del constructor de `QueryCache`
 *    sólo dispara cuando la query pasa a `status: 'error'`, o sea cuando NO
 *    hay datos previos. Como el persister de la Task 0 hace que casi
 *    siempre haya datos previos, ese `onError` casi nunca se disparaba.
 * 2. `networkMode: 'always'` (ver abajo) evita que React Query pause los
 *    reintentos esperando un evento `online` del navegador que puede no
 *    llegar nunca — pero en algunos entornos (verificado con la API caída
 *    del todo) la query igual queda en `fetchStatus: 'paused'` en vez de
 *    llegar a `error`. Por eso `queryCache.subscribe` también escucha
 *    `action.type === 'pause'`, no sólo `'error'` — una query pausada
 *    tampoco se está actualizando, y el operador necesita saberlo igual.
 */
import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import { notifyError } from '@/shared/notify';

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Los datos de este admin cambian por acción de otros operadores, no
      // por polling — no tiene sentido refetchear agresivo por defecto.
      staleTime: 30_000,
      retry: 1,
      // `networkMode: 'online'` (default) PAUSA los reintentos cuando React
      // Query cree que el navegador está offline, y sólo reanuda con el
      // evento `online` del navegador — que puede no llegar nunca si sólo
      // se cayó la API, no la conexión real (verificado en vivo, Task 6: la
      // query quedaba en `fetchStatus: 'paused'` para siempre, sin pasar
      // nunca a `error`, así que el aviso de la Task 1 no tenía nada que
      // notificar). `'always'` ignora ese estado y deja que la query falle
      // y liquide sus reintentos como cualquier request — es lo que este
      // admin necesita: un fallo real, no una espera indefinida.
      networkMode: 'always',
    },
    mutations: {
      retry: 0,
      networkMode: 'always',
    },
  },
  queryCache: new QueryCache(),
  mutationCache: new MutationCache({
    onError: (error) => notifyError(describeError(error)),
  }),
});

// Ver comentario del encabezado: esto cubre también los refetch de fondo
// que fallan sobre una query con datos ya cacheados (el caso que motivó
// esta tarea), no sólo el primer intento sin caché previa.
// No renotificar la misma query en la misma ventana de "está caída" — sin
// esto, cada una de las ~10 queries de un mismo hidratado dispararía su
// propio toast (se pisarían entre sí en la UI, pero igual sería ruido en
// `notifyError`). Se resetea apenas una query vuelve a andar.
const notifiedQueryKeys = new Set<string>();

queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== 'updated') return;
  const key = JSON.stringify(event.query.queryKey);

  if (event.action.type === 'success') {
    notifiedQueryKeys.delete(key);
    return;
  }
  if (event.action.type === 'error' || event.action.type === 'pause') {
    if (notifiedQueryKeys.has(key)) return;
    notifiedQueryKeys.add(key);
    const message = event.action.type === 'error'
      ? describeError(event.action.error)
      : 'No se pudo conectar con el servidor. Mostrando la última información disponible.';
    notifyError(message);
  }
});
