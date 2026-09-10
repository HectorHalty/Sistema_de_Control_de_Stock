export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function isCursorPage<T>(value: unknown): value is CursorPage<T> {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as { items?: unknown; nextCursor?: unknown };
  return Array.isArray(row.items) && (row.nextCursor === null || typeof row.nextCursor === 'string');
}
