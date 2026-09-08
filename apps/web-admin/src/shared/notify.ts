/**
 * Notificación global de errores — Proyecto C, Task 1
 * (docs/superpowers/plans/2026-09-07-admin-fuente-de-verdad-c.md).
 *
 * Pub/sub mínimo, sin dependencias: `app/queryClient.ts` vive fuera del
 * árbol de React (no puede usar hooks), así que necesita una forma de
 * avisarle a la UI que algo falló. `<GlobalToast />` es el único suscriptor
 * en producción; los tests pueden suscribirse también para verificar que un
 * error efectivamente se publicó.
 */
export interface NotifyEvent {
  id: number;
  message: string;
}

type Listener = (event: NotifyEvent) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function notifyError(message: string): void {
  const event: NotifyEvent = { id: nextId++, message };
  for (const listener of listeners) listener(event);
}

export function subscribeToErrors(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
