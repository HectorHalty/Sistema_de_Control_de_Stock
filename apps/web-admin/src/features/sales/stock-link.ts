import type { Product, SalesProduct, SalesTicket } from '@/app/components/store';
import { isLocalOnlyId } from '@/shared/utils/local-ids';

export interface SalesCartLine {
  salesProductId: string;
  quantity: number;
}

/** Misma precisión que la API (`sales-stock.round3`). */
export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export type StockAllocation = {
  stockProductId: string;
  warehouseId: string;
  quantity: number;
};

export function parseStockAllocations(raw: unknown): StockAllocation[] {
  if (!Array.isArray(raw)) return [];
  const out: StockAllocation[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const stockProductId = typeof rec.stockProductId === 'string' ? rec.stockProductId : '';
    const warehouseId = typeof rec.warehouseId === 'string' ? rec.warehouseId : '';
    const quantity = round3(Number(rec.quantity));
    if (!stockProductId || !warehouseId || quantity === 0 || Number.isNaN(quantity)) continue;
    out.push({ stockProductId, warehouseId, quantity: Math.abs(quantity) });
  }
  return mergeAllocations(out);
}

function mergeAllocations(allocs: StockAllocation[]): StockAllocation[] {
  const map = new Map<string, StockAllocation>();
  for (const a of allocs) {
    const qty = round3(a.quantity);
    if (qty === 0) continue;
    const key = `${a.stockProductId}::${a.warehouseId}`;
    const prev = map.get(key);
    if (prev) prev.quantity = round3(prev.quantity + qty);
    else map.set(key, { stockProductId: a.stockProductId, warehouseId: a.warehouseId, quantity: qty });
  }
  return [...map.values()].filter(a => a.quantity > 0);
}

function levelsFromProducts(products: Product[]) {
  const levels: { productId: string; warehouseId: string; quantity: number }[] = [];
  for (const product of products) {
    const warehouses = [...product.stockByWarehouse].sort((a, b) =>
      a.warehouseId.localeCompare(b.warehouseId),
    );
    for (const ws of warehouses) {
      levels.push({
        productId: product.id,
        warehouseId: ws.warehouseId,
        quantity: ws.quantity,
      });
    }
  }
  return levels;
}

/** Greedy por almacén (ordenado por warehouseId), igual que checkout en API. */
export function allocateStockForCart(
  cart: SalesCartLine[],
  salesProducts: SalesProduct[],
  stockProducts: Product[],
): StockAllocation[] {
  const required = buildRequiredStockFromCart(cart, salesProducts);
  const remaining: Record<string, number> = {};
  for (const [id, qty] of Object.entries(required)) {
    remaining[id] = round3(qty);
  }

  const allocations: StockAllocation[] = [];
  for (const level of levelsFromProducts(stockProducts)) {
    const need = remaining[level.productId] || 0;
    if (need <= 0) continue;
    const deduction = round3(Math.min(Number(level.quantity), need));
    if (deduction <= 0) continue;
    remaining[level.productId] = round3(need - deduction);
    allocations.push({
      stockProductId: level.productId,
      warehouseId: level.warehouseId,
      quantity: deduction,
    });
  }
  return mergeAllocations(allocations);
}

export function applyStockAllocations(
  stockProducts: Product[],
  allocations: StockAllocation[],
  sign: 1 | -1,
): Product[] {
  const delta = new Map<string, number>();
  for (const alloc of allocations) {
    const key = `${alloc.stockProductId}::${alloc.warehouseId}`;
    delta.set(key, round3((delta.get(key) || 0) + sign * alloc.quantity));
  }
  return stockProducts.map(product => ({
    ...product,
    stockByWarehouse: product.stockByWarehouse.map(ws => {
      const d = delta.get(`${product.id}::${ws.warehouseId}`) || 0;
      if (!d) return ws;
      return { ...ws, quantity: round3(ws.quantity + d) };
    }),
  }));
}

/** True si alguna receta del carrito (o de una promo anidada) usa un id de stock local. */
export function cartHasLocalStockIds(cart: SalesCartLine[], salesProducts: SalesProduct[]): boolean {
  const salesMap = new Map(salesProducts.map(p => [p.id, p]));
  const visit = (spId: string, seen: Set<string>): boolean => {
    if (seen.has(spId)) return false;
    seen.add(spId);
    const sp = salesMap.get(spId);
    if (!sp) return true;
    if (sp.kind === 'promo' && (sp.bundle?.length ?? 0) > 0) {
      return (sp.bundle ?? []).some(item => visit(item.salesProductId, seen));
    }
    return sp.recipe.some(r => isLocalOnlyId(r.stockProductId));
  };
  return cart.some(item => visit(item.salesProductId, new Set()));
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
    required[recipeItem.stockProductId] = round3(
      (required[recipeItem.stockProductId] || 0) + recipeItem.quantity * multiplier,
    );
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
  return applyStockAllocations(
    stockProducts,
    allocateStockForCart(cart, salesProducts, stockProducts),
    -1,
  );
}

export function restoreStockForTicket(
  stockProducts: Product[],
  ticket: SalesTicket,
  salesProducts: SalesProduct[],
): Product[] {
  const fromSnapshot = parseStockAllocations(ticket.stockAllocations);
  if (fromSnapshot.length > 0) {
    return applyStockAllocations(stockProducts, fromSnapshot, 1);
  }

  const cartLines: SalesCartLine[] = ticket.items.map(item => ({
    salesProductId: item.salesProductId,
    quantity: item.quantity,
  }));
  const required = buildRequiredStockFromCart(cartLines, salesProducts);

  return stockProducts.map(product => {
    const qty = round3(required[product.id] || 0);
    if (qty <= 0 || product.stockByWarehouse.length === 0) return product;
    const firstWarehouseId = [...product.stockByWarehouse]
      .map(ws => ws.warehouseId)
      .sort((a, b) => a.localeCompare(b))[0];
    return {
      ...product,
      stockByWarehouse: product.stockByWarehouse.map(ws =>
        ws.warehouseId === firstWarehouseId
          ? { ...ws, quantity: round3(ws.quantity + qty) }
          : ws,
      ),
    };
  });
}
