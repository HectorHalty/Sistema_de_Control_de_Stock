import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type SalesProductForStock = {
  id: string;
  kind: string;
  recipe: Array<{ stockProductId: string; quantity: Prisma.Decimal }>;
  bundleItems: Array<{ componentProductId: string; quantity: number }>;
};

const SALES_PRODUCT_STOCK_INCLUDE = {
  recipe: true,
  bundleItems: true,
} as const;

export const SALES_PRODUCT_API_INCLUDE = {
  recipe: { include: { stockProduct: true } },
  bundleItems: {
    include: {
      componentProduct: { select: { id: true, name: true, emoji: true } },
    },
  },
  categoriaVenta: { select: { name: true } },
} as const;

export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export type StockLevelRow = {
  id?: string;
  productId: string;
  warehouseId: string;
  quantity: number;
};

/** Snapshot de descuento/restore por almacén (cantidades siempre positivas). */
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

export function mergeAllocations(allocs: StockAllocation[]): StockAllocation[] {
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

/** Reparte el requerido de forma greedy sobre niveles ya ordenados (mismo criterio que checkout). */
export function allocateDeduction(
  levels: StockLevelRow[],
  required: Record<string, number>,
): {
  allocations: StockAllocation[];
  missing: Array<{ stockProductId: string; required: number; available: number }>;
} {
  const remaining: Record<string, number> = {};
  for (const [id, qty] of Object.entries(required)) {
    remaining[id] = round3(qty);
  }

  const availableByProduct: Record<string, number> = {};
  for (const level of levels) {
    availableByProduct[level.productId] = round3(
      (availableByProduct[level.productId] || 0) + Number(level.quantity),
    );
  }

  const missing: Array<{ stockProductId: string; required: number; available: number }> = [];
  for (const [stockProductId, requiredQty] of Object.entries(required)) {
    const available = availableByProduct[stockProductId] || 0;
    if (available < requiredQty) {
      missing.push({ stockProductId, required: requiredQty, available });
    }
  }
  if (missing.length > 0) {
    return { allocations: [], missing };
  }

  const allocations: StockAllocation[] = [];
  for (const level of levels) {
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
  return { allocations: mergeAllocations(allocations), missing: [] };
}

/** Invierte movimientos de venta (qty negativa) a allocaciones de restore positivas. */
export function invertSaleMovements(
  movements: Array<{ productId: string; warehouseId?: string | null; quantity: number }>,
): StockAllocation[] {
  return mergeAllocations(
    movements
      .filter(m => m.warehouseId && m.quantity !== 0)
      .map(m => ({
        stockProductId: m.productId,
        warehouseId: m.warehouseId as string,
        quantity: Math.abs(Number(m.quantity)),
      })),
  );
}

export function scaleAllocations(allocs: StockAllocation[], factor: number): StockAllocation[] {
  if (factor <= 0) return [];
  if (factor === 1) return mergeAllocations(allocs);
  return mergeAllocations(
    allocs.map(a => ({ ...a, quantity: round3(a.quantity * factor) })),
  );
}

/**
 * Reparte allocaciones de carrito a líneas según la contribución de cada ítem
 * a cada producto de stock. El último ítem absorbe el redondeo.
 */
export function splitAllocationsToItems(
  items: Array<{ salesProductId: string; quantity: number }>,
  spMap: Map<string, SalesProductForStock>,
  cartAllocations: StockAllocation[],
): StockAllocation[][] {
  const totalRequired = buildRequiredByStockProduct(items, spMap);
  const pool = new Map<string, StockAllocation[]>();
  for (const a of cartAllocations) {
    const list = pool.get(a.stockProductId) ?? [];
    list.push({ ...a });
    pool.set(a.stockProductId, list);
  }

  const takeFromPool = (stockProductId: string, qty: number): StockAllocation[] => {
    const need = round3(qty);
    if (need <= 0) return [];
    const rows = pool.get(stockProductId) ?? [];
    let remaining = need;
    const taken: StockAllocation[] = [];
    for (const row of rows) {
      if (remaining <= 0) break;
      const chunk = round3(Math.min(row.quantity, remaining));
      if (chunk <= 0) continue;
      row.quantity = round3(row.quantity - chunk);
      remaining = round3(remaining - chunk);
      taken.push({ stockProductId, warehouseId: row.warehouseId, quantity: chunk });
    }
    return taken;
  };

  return items.map((item, index) => {
    const isLast = index === items.length - 1;
    if (isLast) {
      const leftover: StockAllocation[] = [];
      for (const rows of pool.values()) {
        leftover.push(...rows.filter(r => r.quantity > 0));
      }
      return mergeAllocations(leftover);
    }
    const itemRequired = buildRequiredByStockProduct([item], spMap);
    const taken: StockAllocation[] = [];
    for (const [stockId, qty] of Object.entries(itemRequired)) {
      taken.push(...takeFromPool(stockId, qty));
    }
    return mergeAllocations(taken);
  });
}

export function assertSimpleProductsHaveRecipes(
  items: Array<{ salesProductId: string }>,
  spMap: Map<string, SalesProductForStock>,
): void {
  const missing: string[] = [];

  const walk = (spId: string, visiting: Set<string>) => {
    const sp = spMap.get(spId);
    if (!sp) return;
    if (sp.kind === 'promo') {
      if (visiting.has(spId)) return;
      visiting.add(spId);
      for (const item of sp.bundleItems) {
        walk(item.componentProductId, visiting);
      }
      visiting.delete(spId);
      return;
    }
    if (!sp.recipe || sp.recipe.length === 0) {
      missing.push(spId);
    }
  };

  for (const item of items) {
    walk(item.salesProductId, new Set());
  }
  if (missing.length > 0) {
    throw new ConflictException({
      message: 'Sales product has no stock recipe',
      missing: [...new Set(missing)].map(id => ({ stockProductId: id, required: 1, available: 0 })),
    });
  }
}

/** Carga productos de venta y sus componentes (transitivo) para calcular stock. */
export async function loadSalesProductsForStock(
  tx: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  rootIds: string[],
): Promise<Map<string, SalesProductForStock>> {
  const collected = new Map<string, SalesProductForStock>();
  const queue = [...new Set(rootIds)];

  while (queue.length > 0) {
    const batch = queue.splice(0, queue.length).filter(id => !collected.has(id));
    if (batch.length === 0) continue;

    const rows = await tx.productoVenta.findMany({
      where: { id: { in: batch } },
      include: SALES_PRODUCT_STOCK_INCLUDE,
    });

    for (const row of rows) {
      collected.set(row.id, row);
      if (row.kind === 'promo') {
        for (const item of row.bundleItems) {
          if (!collected.has(item.componentProductId)) {
            queue.push(item.componentProductId);
          }
        }
      }
    }
  }

  return collected;
}

export function buildRequiredByStockProduct(
  items: Array<{ salesProductId: string; quantity: number }>,
  spMap: Map<string, SalesProductForStock>,
): Record<string, number> {
  const required: Record<string, number> = {};

  const addFrom = (spId: string, multiplier: number, visiting: Set<string>) => {
    const sp = spMap.get(spId);
    if (!sp) return;

    if (sp.kind === 'promo') {
      if (sp.bundleItems.length === 0) {
        throw new ConflictException(`Promo ${spId} has no components configured`);
      }
      if (visiting.has(spId)) {
        throw new ConflictException('Circular promo reference detected');
      }
      visiting.add(spId);
      for (const item of sp.bundleItems) {
        addFrom(item.componentProductId, multiplier * item.quantity, visiting);
      }
      visiting.delete(spId);
      return;
    }

    for (const recipeItem of sp.recipe) {
      const key = recipeItem.stockProductId;
      required[key] = round3(
        (required[key] || 0) + Number(recipeItem.quantity) * multiplier,
      );
    }
  };

  for (const item of items) {
    addFrom(item.salesProductId, item.quantity, new Set());
  }

  return required;
}

export function assertValidPromoBundle(
  promoId: string | undefined,
  bundle: Array<{ componentProductId: string; quantity: number }>,
) {
  if (bundle.length === 0) {
    throw new BadRequestException('Una promo debe incluir al menos un producto');
  }
  const seen = new Set<string>();
  for (const item of bundle) {
    if (!item.componentProductId) {
      throw new BadRequestException('Componente de promo inválido');
    }
    if (promoId && item.componentProductId === promoId) {
      throw new BadRequestException('Una promo no puede incluirse a sí misma');
    }
    if (item.quantity < 1 || !Number.isInteger(item.quantity)) {
      throw new BadRequestException('La cantidad de cada componente debe ser un entero ≥ 1');
    }
    if (seen.has(item.componentProductId)) {
      throw new BadRequestException('Componente duplicado en la promo');
    }
    seen.add(item.componentProductId);
  }
}

export function assertNoPromoCycle(
  promoId: string,
  bundle: Array<{ componentProductId: string }>,
  spMap: Map<string, SalesProductForStock>,
) {
  const visiting = new Set<string>([promoId]);

  const walk = (id: string) => {
    const sp = spMap.get(id);
    if (!sp || sp.kind !== 'promo') return;
    for (const item of sp.bundleItems) {
      if (visiting.has(item.componentProductId)) {
        throw new BadRequestException('La promo crearía una referencia circular');
      }
      visiting.add(item.componentProductId);
      walk(item.componentProductId);
      visiting.delete(item.componentProductId);
    }
  };

  for (const item of bundle) {
    walk(item.componentProductId);
  }
}
