import { buildRequiredByStockProduct, type SalesProductForStock } from '../sales/sales-stock';

/**
 * Convierte el `missing` del ConflictException de stock (ids de insumos internos)
 * en un mensaje en español con los nombres de las líneas del pedido afectadas.
 */
export function translateStockConflict(
  missing: Array<{ stockProductId: string }>,
  lines: Array<{ salesProductId: string; name: string }>,
  spMap: Map<string, SalesProductForStock>,
): string {
  const missingIds = new Set(missing.map((m) => m.stockProductId));
  const affected: string[] = [];
  for (const line of lines) {
    let required: Record<string, number>;
    try {
      required = buildRequiredByStockProduct(
        [{ salesProductId: line.salesProductId, quantity: 1 }],
        spMap,
      );
    } catch {
      required = {};
    }
    if (Object.keys(required).some((id) => missingIds.has(id))) {
      affected.push(line.name);
    }
  }
  const names = affected.length ? [...new Set(affected)].join(', ') : 'algunos productos';
  return `No hay stock suficiente para: ${names}`;
}
