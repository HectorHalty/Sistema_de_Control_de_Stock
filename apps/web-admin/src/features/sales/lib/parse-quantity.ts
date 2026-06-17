/** Accepts "0,1", "0.1", "10" etc. Returns null if empty or invalid. */
export function parseQuantityInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized === '' || normalized === '.') return null;
  const qty = Number(normalized);
  if (!Number.isFinite(qty)) return null;
  return qty;
}

/** Display quantity with comma as decimal separator (es-AR). */
export function formatQuantityInput(value: number): string {
  return String(value).replace('.', ',');
}

/** While typing: digits with optional comma or dot decimal separator. */
export function isPartialQuantityInput(raw: string): boolean {
  return /^\d*[,.]?\d*$/.test(raw);
}
