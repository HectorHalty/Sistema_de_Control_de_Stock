import { storageKeys } from '@/shared/storage/keys';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** UUID del usuario autenticado (fuente: sesión de login en localStorage). */
export function getSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem(storageKeys.auth.user);
    if (!raw) return null;
    const user = JSON.parse(raw) as { id?: string };
    return user.id && isUuid(user.id) ? user.id : null;
  } catch {
    return null;
  }
}
