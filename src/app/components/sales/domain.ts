import type { SalesMenuProduct, SalesOrderItem, SalesValidationResult, StockProduct } from './types';

function getTotalStock(product: StockProduct): number {
  return product.stockByWarehouse.reduce((sum, item) => sum + item.quantity, 0);
}

export function buildRequiredByStockProduct(
  orderItems: SalesOrderItem[],
  menuProducts: SalesMenuProduct[],
): Record<string, number> {
  const menuMap = new Map(menuProducts.map(product => [product.id, product]));
  const required: Record<string, number> = {};

  orderItems.forEach(orderItem => {
    const menuProduct = menuMap.get(orderItem.menuProductId);
    if (!menuProduct) return;

    menuProduct.recipe.forEach(recipeItem => {
      required[recipeItem.stockProductId] = (required[recipeItem.stockProductId] || 0) + recipeItem.quantity * orderItem.quantity;
    });
  });

  return required;
}

export function validateStockForOrder(
  orderItems: SalesOrderItem[],
  menuProducts: SalesMenuProduct[],
  stockProducts: StockProduct[],
): SalesValidationResult {
  const required = buildRequiredByStockProduct(orderItems, menuProducts);
  const stockMap = new Map(stockProducts.map(product => [product.id, product]));

  const missing = Object.entries(required)
    .map(([stockProductId, requiredQty]) => {
      const stockProduct = stockMap.get(stockProductId);
      const available = stockProduct ? getTotalStock(stockProduct) : 0;
      return { stockProductId, required: requiredQty, available };
    })
    .filter(item => item.available < item.required);

  return {
    ok: missing.length === 0,
    missing,
    requiredByStockProduct: required,
  };
}

export function applyStockDeduction(
  stockProducts: StockProduct[],
  requiredByStockProduct: Record<string, number>,
): StockProduct[] {
  return stockProducts.map(product => {
    const required = requiredByStockProduct[product.id] || 0;
    if (required <= 0) return product;

    let remaining = required;
    const updatedStockByWarehouse = product.stockByWarehouse.map(item => {
      if (remaining <= 0) return item;
      const deduction = Math.min(item.quantity, remaining);
      remaining -= deduction;
      return { ...item, quantity: item.quantity - deduction };
    });

    return { ...product, stockByWarehouse: updatedStockByWarehouse };
  });
}
