import { describe, it, expect } from 'vitest';
import {
  aggregateSalesLineItems,
  netRestoreQuantitiesAfterPartialReturns,
  computeReturnableFromTotals,
} from '../../src/sales/sales-integrity';

describe('sales-integrity', () => {
  it('aggregateSalesLineItems merges duplicate product rows', () => {
    const agg = aggregateSalesLineItems([
      { salesProductId: 'p1', quantity: 2 },
      { salesProductId: 'p1', quantity: 3 },
      { salesProductId: 'p2', quantity: 1 },
    ]);
    expect(agg).toEqual([
      { salesProductId: 'p1', quantity: 5 },
      { salesProductId: 'p2', quantity: 1 },
    ]);
  });

  it('netRestore subtracts proportional partial returns on void', () => {
    const sold = { p1: 10 };
    const returned = { p1: 5 };
    const net = netRestoreQuantitiesAfterPartialReturns(
      [{ salesProductId: 'p1', quantity: 10 }],
      sold,
      returned,
    );
    expect(net).toEqual([{ salesProductId: 'p1', quantity: 5 }]);
  });

  it('netRestore splits returns across multiple emitido tickets', () => {
    const sold = { p1: 10 };
    const returned = { p1: 5 };
    const net = netRestoreQuantitiesAfterPartialReturns(
      [
        { salesProductId: 'p1', quantity: 6 },
        { salesProductId: 'p1', quantity: 4 },
      ],
      sold,
      returned,
    );
    expect(net[0].quantity + net[1].quantity).toBe(5);
  });

  it('computeReturnableFromTotals matches sold minus returned', () => {
    expect(computeReturnableFromTotals({ a: 10, b: 3 }, { a: 4 })).toEqual({ a: 6, b: 3 });
  });
});
