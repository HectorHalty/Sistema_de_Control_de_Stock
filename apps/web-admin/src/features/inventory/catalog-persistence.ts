import { isLocalOnlyId } from '@/shared/utils/local-ids';

/**
 * Hidratación API-first: el servidor gana, pero se conservan altas locales
 * todavía no sincronizadas (ids no UUID) que no chocan con un id o nombre del servidor.
 */
export function mergeServerWithPendingLocal<T extends { id: string }>(
  server: T[],
  prev: T[],
  opts?: {
    nameOf?: (item: T) => string | undefined;
    sort?: (a: T, b: T) => number;
    /** false: el servidor es la lista completa (pedidos PED-* locales no sobreviven). */
    keepPendingLocal?: boolean;
  },
): T[] {
  if (opts?.keepPendingLocal === false) {
    const next = [...server];
    if (opts.sort) next.sort(opts.sort);
    return next;
  }

  const serverIds = new Set(server.map(item => item.id));
  const serverNames = new Set<string>();
  if (opts?.nameOf) {
    for (const item of server) {
      const name = opts.nameOf(item)?.trim().toLowerCase();
      if (name) serverNames.add(name);
    }
  }

  const pendingLocal = prev.filter(item => {
    if (!isLocalOnlyId(item.id) || serverIds.has(item.id)) return false;
    if (opts?.nameOf) {
      const name = opts.nameOf(item)?.trim().toLowerCase();
      if (name && serverNames.has(name)) return false;
    }
    return true;
  });

  const merged = [...server, ...pendingLocal];
  if (opts?.sort) merged.sort(opts.sort);
  return merged;
}

/** IDs de producto listos para POST (UUID). Descarta ids locales `p…` / `cat…`. */
export function uuidProductIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || isLocalOnlyId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Resuelve la categoría a enviar en create/update de producto.
 * Nunca devuelve un id local: el caller debe persistirla antes o este throw.
 */
export function resolveCategoryForProduct(
  categories: Array<{ id: string; name: string }>,
  categoryName: string,
): { id: string; name: string } {
  const name = categoryName.trim();
  if (!name) throw new Error('La categoría es obligatoria');
  const found = categories.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
  if (!found) throw new Error(`Categoría no encontrada: ${categoryName}`);
  if (isLocalOnlyId(found.id)) {
    throw new Error(`La categoría "${found.name}" todavía no está sincronizada con el servidor.`);
  }
  return found;
}
