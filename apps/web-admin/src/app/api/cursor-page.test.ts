import { describe, expect, it } from 'vitest';
import { isCursorPage } from './cursor-page';

describe('isCursorPage', () => {
  it('acepta una página bien formada', () => {
    expect(isCursorPage({ items: [{ id: 'a' }], nextCursor: 'a' })).toBe(true);
    expect(isCursorPage({ items: [], nextCursor: null })).toBe(true);
  });

  it('rechaza un array plano (respuesta POS)', () => {
    expect(isCursorPage([{ id: 'a' }])).toBe(false);
  });
});
