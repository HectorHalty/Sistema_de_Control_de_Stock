import { ConflictException } from '@nestjs/common';
import {
  buildRequiredByStockProduct,
  type SalesProductForStock,
} from '../sales/sales-stock';

/**
 * ¿El ítem del menú tiene stock para al menos 1 unidad?
 * Devuelve false si la receta no es resoluble (simple sin receta, promo sin
 * componentes, ciclo) o si algún insumo requerido supera el disponible.
 */
export function menuItemHasStock(
  salesProductId: string,
  spMap: Map<string, SalesProductForStock>,
  availableByStockProduct: Map<string, number>,
): boolean {
  const sp = spMap.get(salesProductId);
  if (!sp) return false;
  if (sp.kind !== 'promo' && sp.recipe.length === 0) return false;

  let required: Record<string, number>;
  try {
    required = buildRequiredByStockProduct([{ salesProductId, quantity: 1 }], spMap);
  } catch (err) {
    if (err instanceof ConflictException) return false;
    throw err;
  }

  const entries = Object.entries(required);
  if (entries.length === 0) return false;

  for (const [stockProductId, need] of entries) {
    const available = availableByStockProduct.get(stockProductId) ?? 0;
    if (available < need) return false;
  }
  return true;
}
