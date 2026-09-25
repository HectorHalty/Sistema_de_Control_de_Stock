import { describe, expect, it } from 'vitest';
import {
  NEGATIVE_ENTRY_LOCK_MS,
  parseStockQuantityDraft,
  rejectStockKey,
  stockEditIntroducesMinus,
} from './stock-quantity-input';

describe('stock quantity input', () => {
  it('detecta un menos pegado o escrito sobre la cantidad', () => {
    expect(stockEditIntroducesMinus('10', '-', 0, 2)).toBe(true);
    expect(stockEditIntroducesMinus('10', '9', 2, 2)).toBe(false);
    expect(stockEditIntroducesMinus('10', '-9', 0, 0)).toBe(true);
  });

  it('frena el menos y el resto de un -999 rápido sin tocar la cantidad', () => {
    const now = 1_000;
    const minus = rejectStockKey('-', 'Minus', 0, now);
    expect(minus.prevent).toBe(true);
    expect(minus.negative).toBe(true);
    expect(minus.lockUntil).toBe(now + NEGATIVE_ENTRY_LOCK_MS);

    const digit = rejectStockKey('9', 'Digit9', minus.lockUntil, now + 50);
    expect(digit.prevent).toBe(true);
    expect(digit.negative).toBe(false);

    const later = rejectStockKey('9', 'Digit9', minus.lockUntil, now + NEGATIVE_ENTRY_LOCK_MS);
    expect(later.prevent).toBe(false);
  });

  it('parsea vacío y enteros, y rechaza el signo menos', () => {
    expect(parseStockQuantityDraft('', false)).toEqual({ kind: 'empty' });
    expect(parseStockQuantityDraft('10', false)).toEqual({ kind: 'ok', quantity: 10 });
    expect(parseStockQuantityDraft('-999', false)).toEqual({ kind: 'negative' });
    expect(parseStockQuantityDraft('0999', false)).toEqual({ kind: 'ok', quantity: 999 });
    expect(parseStockQuantityDraft('10.5', true)).toEqual({ kind: 'ok', quantity: 10.5 });
    expect(parseStockQuantityDraft('10.', false)).toEqual({ kind: 'invalid' });
  });
});
