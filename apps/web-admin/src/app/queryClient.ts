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
 * query o mutation que falle avisa al operador, vía `notifyError`
 * (`shared/notify.ts`) → `<GlobalToast />` (Task 1).
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
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => notifyError(describeError(error)),
  }),
  mutationCache: new MutationCache({
    onError: (error) => notifyError(describeError(error)),
  }),
});
