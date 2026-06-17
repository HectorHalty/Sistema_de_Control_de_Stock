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
} as const;

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
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

    const rows = await tx.salesProduct.findMany({
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
