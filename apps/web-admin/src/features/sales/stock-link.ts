import type { Product, SalesProduct, SalesTicket } from '@/app/components/store';

export interface SalesCartLine {
  salesProductId: string;
  quantity: number;
}

export function getTotalStockQuantity(product: Product): number {
  return product.stockByWarehouse.reduce((sum, item) => sum + item.quantity, 0);
}

export type RecipeStockItem = { stockProductId: string; quantity: number };

function isPromoProduct(sp: Pick<SalesProduct, 'kind' | 'bundle'>): boolean {
  return sp.kind === 'promo' && (sp.bundle?.length ?? 0) > 0;
}

function addStockRequirementsFromSalesProduct(
  spId: string,
  multiplier: number,
  salesMap: Map<string, SalesProduct>,
  required: Record<string, number>,
  visiting: Set<string>,
): void {
  const sp = salesMap.get(spId);
  if (!sp) return;

  if (isPromoProduct(sp)) {
    if (visiting.has(spId)) return;
    visiting.add(spId);
    for (const item of sp.bundle ?? []) {
      addStockRequirementsFromSalesProduct(
        item.salesProductId,
        multiplier * item.quantity,
        salesMap,
        required,
        visiting,
      );
    }
    visiting.delete(spId);
    return;
  }

  for (const recipeItem of sp.recipe) {
    required[recipeItem.stockProductId] =
      (required[recipeItem.stockProductId] || 0) + recipeItem.quantity * multiplier;
  }
}

/** Units sellable from a recipe and per-ingredient availability (ids → total qty in stock). */
export function computeSellableStock(
  recipe: RecipeStockItem[],
  getAvailable: (stockProductId: string) => number,
): number {
  if (recipe.length === 0) return 0;

  let maxUnits = Number.POSITIVE_INFINITY;

  for (const recipeItem of recipe) {
    if (recipeItem.quantity <= 0) return 0;
    const available = getAvailable(recipeItem.stockProductId);
    const units = available / recipeItem.quantity;
    maxUnits = Math.min(maxUnits, Math.floor(units + 1e-9));
  }

  return Number.isFinite(maxUnits) ? maxUnits : 0;
}

/** Units that can still be sold according to recipe ingredients or promo components. */
export function getMaxSellableUnits(
  salesProduct: SalesProduct,
  stockProducts: Product[],
  allSalesProducts: SalesProduct[] = [],
): number {
  if (!salesProduct.active) return 0;

  const catalog = allSalesProducts.length > 0 ? allSalesProducts : [salesProduct];
  const visiting = new Set<string>();

  const sellable = (sp: SalesProduct): number => {
    if (!sp.active) return 0;
    if (isPromoProduct(sp)) {
      if (visiting.has(sp.id)) return 0;
      visiting.add(sp.id);
      let minUnits = Number.POSITIVE_INFINITY;
      for (const item of sp.bundle ?? []) {
        const component = catalog.find(p => p.id === item.salesProductId);
        if (!component || item.quantity <= 0) {
          visiting.delete(sp.id);
          return 0;
        }
        const available = sellable(component);
        minUnits = Math.min(minUnits, Math.floor(available / item.quantity));
      }
      visiting.delete(sp.id);
      return Number.isFinite(minUnits) ? minUnits : 0;
    }

    if (sp.recipe.length === 0) return 0;
    const stockMap = new Map(stockProducts.map(p => [p.id, getTotalStockQuantity(p)]));
    return computeSellableStock(sp.recipe, id => stockMap.get(id) ?? 0);
  };

  return sellable(salesProduct);
}

export function isSalesProductAvailable(
  salesProduct: SalesProduct,
  stockProducts: Product[],
  allSalesProducts?: SalesProduct[],
): boolean {
  return getMaxSellableUnits(salesProduct, stockProducts, allSalesProducts) > 0;
}

export function buildRequiredStockFromCart(
  cart: SalesCartLine[],
  salesProducts: SalesProduct[],
): Record<string, number> {
  const salesMap = new Map(salesProducts.map(p => [p.id, p]));
  const required: Record<string, number> = {};

  for (const item of cart) {
    addStockRequirementsFromSalesProduct(
      item.salesProductId,
      item.quantity,
      salesMap,
      required,
      new Set(),
    );
  }

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
    if (!sp) return true;
    if (isPromoProduct(sp)) return false;
    return sp.recipe.length === 0;
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
