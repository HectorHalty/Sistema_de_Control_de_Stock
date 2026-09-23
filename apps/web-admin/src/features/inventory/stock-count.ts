import type { Product } from '@/app/components/store';

export type StockEdit = {
  warehouseId: string;
  productId: string;
  previousStock: number;
  newStock: number;
};

export type StockCountAdjustment = {
  productId: string;
  warehouseId: string;
  /** Cantidad contada. El servidor la escribe tal cual. */
  quantity: number;
};

function liveQuantity(products: Product[], productId: string, warehouseId: string): number {
  const product = products.find(p => p.id === productId);
  return product?.stockByWarehouse.find(s => s.warehouseId === warehouseId)?.quantity ?? 0;
}

/**
 * Filas cuyo conteo no coincide con el stock real.
 * Manda la cantidad final, no el delta: un delta repetido (220 → 10 y otra vez −210)
 * termina en negativo.
 */
export function buildStockCountAdjustments(
  edits: Pick<StockEdit, 'productId' | 'warehouseId' | 'newStock'>[],
  liveProducts: Product[],
): StockCountAdjustment[] {
  const byKey = new Map<string, StockCountAdjustment>();
  for (const edit of edits) {
    if (edit.newStock === liveQuantity(liveProducts, edit.productId, edit.warehouseId)) continue;
    byKey.set(`${edit.productId}:${edit.warehouseId}`, {
      productId: edit.productId,
      warehouseId: edit.warehouseId,
      quantity: edit.newStock,
    });
  }
  return [...byKey.values()];
}

export function syncStockEdits(prev: StockEdit[], products: Product[]): StockEdit[] {
  const next: StockEdit[] = [];
  for (const product of products) {
    for (const stock of product.stockByWarehouse) {
      const existing = prev.find(
        edit => edit.warehouseId === stock.warehouseId && edit.productId === product.id,
      );
      const dirty = existing !== undefined && existing.newStock !== existing.previousStock;
      next.push({
        warehouseId: stock.warehouseId,
        productId: product.id,
        previousStock: stock.quantity,
        newStock: dirty ? existing.newStock : stock.quantity,
      });
    }
  }
  return next;
}
