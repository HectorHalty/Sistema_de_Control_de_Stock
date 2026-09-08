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
 * El `onError` por defecto de acá abajo es el punto único donde CUALQUIER
 * query o mutation que falle puede avisar al operador (Task 1 conecta el
 * toast real; por ahora sólo loguea para separar infraestructura de UI).
 */
import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';

/** Reemplazado por Task 1 con el toast real. Exportado para que Task 1 lo pise sin tocar este archivo. */
export let notifyQueryError: (message: string) => void = (message) => {
  // eslint-disable-next-line no-console
  console.error('[react-query]', message);
};

export function setQueryErrorNotifier(fn: (message: string) => void): void {
  notifyQueryError = fn;
}

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
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => notifyQueryError(describeError(error)),
  }),
  mutationCache: new MutationCache({
    onError: (error) => notifyQueryError(describeError(error)),
  }),
});
