export const NEGATIVE_STOCK_MESSAGE = 'No se puede dejar el stock en negativo';
export const NEGATIVE_ENTRY_LOCK_MS = 600;

export function stockEditIntroducesMinus(
  current: string,
  insert: string,
  selectionStart: number,
  selectionEnd: number,
): boolean {
  if (insert.includes('-')) return true;
  const next = current.slice(0, selectionStart) + insert + current.slice(selectionEnd);
  return next.includes('-');
}

/** El menos y los caracteres que llegan enseguida no entran al campo. */
export function rejectStockKey(
  key: string,
  code: string,
  lockedUntil: number,
  now = Date.now(),
): { prevent: boolean; lockUntil: number; negative: boolean } {
  const isMinus = key === '-' || key === 'Subtract' || code === 'Minus' || code === 'NumpadSubtract';
  if (isMinus) {
    return { prevent: true, lockUntil: now + NEGATIVE_ENTRY_LOCK_MS, negative: true };
  }
  if (now < lockedUntil && key.length === 1) {
    return { prevent: true, lockUntil: lockedUntil, negative: false };
  }
  return { prevent: false, lockUntil: lockedUntil, negative: false };
}

export function parseStockQuantityDraft(
  raw: string,
  fractional: boolean,
): { kind: 'empty' } | { kind: 'negative' } | { kind: 'invalid' } | { kind: 'ok'; quantity: number } {
  const trimmed = raw.trim();
  if (trimmed === '') return { kind: 'empty' };
  if (trimmed.includes('-')) return { kind: 'negative' };
  if (fractional) {
    if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '.') return { kind: 'invalid' };
    const quantity = Number(trimmed);
    if (!Number.isFinite(quantity)) return { kind: 'invalid' };
    if (quantity < 0) return { kind: 'negative' };
    return { kind: 'ok', quantity };
  }
  if (!/^\d+$/.test(trimmed)) return { kind: 'invalid' };
  return { kind: 'ok', quantity: parseInt(trimmed, 10) };
}
