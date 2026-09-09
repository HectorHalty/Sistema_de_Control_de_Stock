import { describe, it, expect } from 'vitest';
import { reconcileCart } from './reconcile-cart';
import type { CartLine } from './CartContext';

const line = (id: string, name: string): CartLine =>
  ({ id, name, category: 'x', price: 100, kitchen: 'k', qty: 1 } as CartLine);

describe('reconcileCart', () => {
  it('mantiene las líneas que siguen en el menú', () => {
    const res = reconcileCart([line('a', 'A'), line('b', 'B')], new Set(['a', 'b']));
    expect(res.kept.map((l) => l.id)).toEqual(['a', 'b']);
    expect(res.removedNames).toEqual([]);
  });

  it('quita las líneas cuyo id ya no está y reporta sus nombres', () => {
    const res = reconcileCart([line('a', 'A'), line('b', 'B')], new Set(['a']));
    expect(res.kept.map((l) => l.id)).toEqual(['a']);
    expect(res.removedNames).toEqual(['B']);
  });
});
