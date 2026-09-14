export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/** Normaliza `limit` de query string: default razonable, tope duro, sin NaN/negativos. */
export function normalizeLimit(limit?: number | string): number {
  const n = typeof limit === 'string' ? Number(limit) : limit;
  if (!n || !Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

export interface CursorPage<T> {
  items: T[];
  /** id de la última fila devuelta, para pedir la próxima página. `null` si no hay más. */
  nextCursor: string | null;
}

/**
 * Traducir un `findMany` sobre-pedido (`take: limit + 1`) a una página con
 * cursor. El caller pide `limit + 1` filas; si vinieron más de `limit`, hay
 * próxima página y se corta la de más (que sólo sirve para saber si existe).
 *
 * Requiere que las filas tengan `id` y que el `orderBy` del `findMany`
 * incluya `id` como desempate (ver Task 9 de
 * docs/superpowers/plans/2026-09-07-integridad-operacional-b.md) — sin eso
 * el cursor de Prisma no da un orden estable entre páginas.
 */
export function toCursorPage<T extends { id: string }>(rows: T[], limit: number): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? last.id : null };
}
