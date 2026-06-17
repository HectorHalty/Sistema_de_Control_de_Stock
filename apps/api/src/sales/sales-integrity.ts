/** Pure helpers for sales stock integrity (unit-testable). */

export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function aggregateSalesLineItems(
  items: Array<{ salesProductId: string; quantity: number }>,
): Array<{ salesProductId: string; quantity: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.salesProductId, (map.get(item.salesProductId) || 0) + item.quantity);
  }
  return [...map.entries()].map(([salesProductId, quantity]) => ({ salesProductId, quantity }));
}

/**
 * After partial return-items, void/edit must not restore stock already returned.
 * Allocates global returns proportionally across emitido ticket lines per product.
 */
export function netRestoreQuantitiesAfterPartialReturns(
  ticketItems: Array<{ salesProductId: string; quantity: number }>,
  soldByProduct: Record<string, number>,
  returnedByProduct: Record<string, number>,
): Array<{ salesProductId: string; quantity: number }> {
  return ticketItems
    .map(item => {
      const totalSold = soldByProduct[item.salesProductId] || 0;
      const totalReturned = returnedByProduct[item.salesProductId] || 0;
      const proportionalReturned =
        totalSold > 0 ? round3(totalReturned * (item.quantity / totalSold)) : 0;
      const net = round3(item.quantity - proportionalReturned);
      return { salesProductId: item.salesProductId, quantity: net };
    })
    .filter(item => item.quantity > 0);
}

export function computeReturnableFromTotals(
  sold: Record<string, number>,
  returned: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [pid, qty] of Object.entries(sold)) {
    const rem = round3(qty - (returned[pid] || 0));
    if (rem > 0) result[pid] = rem;
  }
  return result;
}
