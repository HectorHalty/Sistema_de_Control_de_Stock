export function cartToCheckoutItems(
  items: Array<{ id: string; qty: number }>,
): Array<{ salesProductId: string; quantity: number }> {
  return items.map((i) => ({ salesProductId: i.id, quantity: i.qty }));
}
