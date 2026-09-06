import { describe, expect, it } from 'vitest';
import { defaultQty } from './RecipeIngredientsEditor';

describe('defaultQty', () => {
  it('arranca en 1 para unidades enteras', () => {
    expect(defaultQty('unidades')).toBe(1);
    expect(defaultQty('cajas')).toBe(1);
  });

  it('arranca en 0.1 para unidades fraccionables', () => {
    expect(defaultQty('kg')).toBe(0.1);
    expect(defaultQty('litros')).toBe(0.1);
  });
});
