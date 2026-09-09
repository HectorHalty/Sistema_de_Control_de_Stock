import type { CartLine } from './CartContext';

export function reconcileCart(
  lines: CartLine[],
  menuIds: Set<string>,
): { kept: CartLine[]; removedNames: string[] } {
  const kept: CartLine[] = [];
  const removedNames: string[] = [];
  for (const line of lines) {
    if (menuIds.has(line.id)) kept.push(line);
    else removedNames.push(line.name);
  }
  return { kept, removedNames };
}
