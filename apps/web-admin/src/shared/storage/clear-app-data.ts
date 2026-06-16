import { storageKeys } from './keys';

function collectStorageKeys(obj: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') keys.push(value);
    else if (value && typeof value === 'object') keys.push(...collectStorageKeys(value as Record<string, unknown>));
  }
  return keys;
}

/** Borra todo el caché local del panel (inventario, ventas, auth, etc.). */
export function clearAllAppData(): void {
  for (const key of collectStorageKeys(storageKeys as Record<string, unknown>)) {
    localStorage.removeItem(key);
  }
}
