import { describe, expect, it } from 'vitest';
import { cartToCheckoutItems } from './checkout-items';

describe('cartToCheckoutItems', () => {
  it('mapea id/qty al contrato de POST /public/orders', () => {
    expect(
      cartToCheckoutItems([
        { id: 'sp-1', qty: 2 },
        { id: 'sp-2', qty: 1 },
      ]),
    ).toEqual([
      { salesProductId: 'sp-1', quantity: 2 },
      { salesProductId: 'sp-2', quantity: 1 },
    ]);
  });
});
