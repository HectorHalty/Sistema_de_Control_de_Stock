import { useEffect, useState } from 'react';
import { subscribeToErrors, type NotifyEvent } from '@/shared/notify';

const AUTO_DISMISS_MS = 6000;

/**
 * Toast global de errores — Proyecto C, Task 1. Se monta una sola vez en la
 * raíz de la app (`App.tsx`) y muestra cualquier error publicado con
 * `notifyError` (incluido el `onError` por defecto de React Query en
 * `app/queryClient.ts`, que lo usa para cualquier query/mutation que falle).
 *
 * No reemplaza los `try/catch` puntuales que ya muestran su propio mensaje
 * en algunas pantallas — es la red de seguridad para lo que antes fallaba
 * en silencio (la hidratación inicial de los 6 hooks `use-*-state.ts`, por
 * ejemplo).
 */
export function GlobalToast() {
  const [event, setEvent] = useState<NotifyEvent | null>(null);

  useEffect(() => subscribeToErrors(setEvent), []);

  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => {
      setEvent((current) => (current?.id === event.id ? null : current));
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [event]);

  if (!event) return null;

  return (
    <div
      role="alert"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg max-w-[90vw] text-sm"
    >
      {event.message}
    </div>
  );
}
