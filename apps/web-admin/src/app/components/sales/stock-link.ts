import type { Product, SalesProduct, SalesTicket } from '../store';

export interface SalesCartLine {
  salesProductId: string;
  quantity: number;
}

export function getTotalStockQuantity(product: Product): number {
  return product.stockByWarehouse.reduce((sum, item) => sum + item.quantity, 0);
}

/** Units that can still be sold according to recipe ingredients in stock. */
export function getMaxSellableUnits(salesProduct: SalesProduct, stockProducts: Product[]): number {
  if (!salesProduct.active || salesProduct.recipe.length === 0) return 0;

  const stockMap = new Map(stockProducts.map(p => [p.id, p]));
  let maxUnits = Number.POSITIVE_INFINITY;

  for (const recipeItem of salesProduct.recipe) {
    if (recipeItem.quantity <= 0) return 0;
    const stock = stockMap.get(recipeItem.stockProductId);
    if (!stock) return 0;
    maxUnits = Math.min(maxUnits, Math.floor(getTotalStockQuantity(stock) / recipeItem.quantity));
  }

  return Number.isFinite(maxUnits) ? maxUnits : 0;
}

export function isSalesProductAvailable(salesProduct: SalesProduct, stockProducts: Product[]): boolean {
  return getMaxSellableUnits(salesProduct, stockProducts) > 0;
}

export function buildRequiredStockFromCart(
  cart: SalesCartLine[],
  salesProducts: SalesProduct[],
): Record<string, number> {
  const salesMap = new Map(salesProducts.map(p => [p.id, p]));
  const required: Record<string, number> = {};

  cart.forEach(item => {
    const sp = salesMap.get(item.salesProductId);
    if (!sp) return;
    sp.recipe.forEach(r => {
      required[r.stockProductId] = (required[r.stockProductId] || 0) + r.quantity * item.quantity;
    });
  });

  return required;
}

export function validateStockForCart(
  cart: SalesCartLine[],
  salesProducts: SalesProduct[],
  stockProducts: Product[],
): { ok: boolean; missing: { name: string; required: number; available: number }[] } {
  const required = buildRequiredStockFromCart(cart, salesProducts);
  const stockMap = new Map(stockProducts.map(p => [p.id, p]));
  const missing: { name: string; required: number; available: number }[] = [];

  Object.entries(required).forEach(([stockId, qty]) => {
    const stock = stockMap.get(stockId);
    const available = stock ? getTotalStockQuantity(stock) : 0;
    if (available < qty) {
      missing.push({ name: stock?.name || stockId, required: qty, available });
    }
  });

  if (cart.some(item => {
    const sp = salesProducts.find(p => p.id === item.salesProductId);
    return !sp || sp.recipe.length === 0;
  })) {
    missing.push({ name: 'Producto sin receta de stock', required: 1, available: 0 });
  }

  return { ok: missing.length === 0, missing };
}

export function deductStockForSale(
  stockProducts: Product[],
  cart: SalesCartLine[],
  salesProducts: SalesProduct[],
): Product[] {
  const required = buildRequiredStockFromCart(cart, salesProducts);

  return stockProducts.map(product => {
    const qty = required[product.id] || 0;
    if (qty <= 0) return product;

    let remaining = qty;
    const updatedStock = product.stockByWarehouse.map(ws => {
      if (remaining <= 0) return ws;
      const deduction = Math.min(ws.quantity, remaining);
      remaining -= deduction;
      return { ...ws, quantity: ws.quantity - deduction };
    });

    return { ...product, stockByWarehouse: updatedStock };
  });
}

export function restoreStockForTicket(
  stockProducts: Product[],
  ticket: SalesTicket,
  salesProducts: SalesProduct[],
): Product[] {
  const cartLines: SalesCartLine[] = ticket.items.map(item => ({
    salesProductId: item.salesProductId,
    quantity: item.quantity,
  }));

  const required = buildRequiredStockFromCart(cartLines, salesProducts);

  return stockProducts.map(product => {
    const qty = required[product.id] || 0;
    if (qty <= 0) return product;
    if (product.stockByWarehouse.length === 0) return product;

    return {
      ...product,
      stockByWarehouse: product.stockByWarehouse.map((ws, idx) =>
        idx === 0 ? { ...ws, quantity: ws.quantity + qty } : ws,
      ),
    };
  });
}
