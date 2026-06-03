import { applyStockDeduction, validateStockForOrder } from '@/features/sales/domain';
import type { SalesMenuProduct, SalesOrderItem, StockProduct } from '@/features/sales/menu-types';

export interface OnlineCheckoutResult {
  ok: boolean;
  missingSummary: string;
  updatedProducts: StockProduct[];
}

export function checkoutOnlineOrder(
  items: SalesOrderItem[],
  menuProducts: SalesMenuProduct[],
  stockProducts: StockProduct[],
): OnlineCheckoutResult {
  const validation = validateStockForOrder(items, menuProducts, stockProducts);

  if (!validation.ok) {
    return {
      ok: false,
      missingSummary: validation.missing
        .map(item => `${item.stockProductId} (${item.available}/${item.required})`)
        .join(', '),
      updatedProducts: stockProducts,
    };
  }

  return {
    ok: true,
    missingSummary: '',
    updatedProducts: applyStockDeduction(stockProducts, validation.requiredByStockProduct),
  };
}
