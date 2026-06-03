import type { Product, SalesProduct, SalesTicket, ConsumptionLog } from '@/app/components/store';

// --- Kitchen Display System types ---

export type KitchenOrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered';

export interface KitchenOrder {
  id: string;
  ticketId: string;
  ticketNumber: number;
  kitchenId: string;
  kitchenName: string;
  items: { salesProductId: string; name: string; quantity: number; emoji: string }[];
  status: KitchenOrderStatus;
  createdAtISO: string;
  updatedAtISO: string;
  operatorName: string;
  tableId?: string;
  tableName?: string;
}

// --- Historical consumption suggestion types ---

export interface ConsumptionBasedSuggestion {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailyConsumption: number;
  totalConsumedInPeriod: number;
  daysInPeriod: number;
  suggestedQuantity: number;
  unit: Product['unit'];
  orderUnit?: number;
}

export interface SuggestionParams {
  dateType: 'regular' | 'after';
  periodMonths: number;
  specificDate?: string; // YYYY-MM-DD to repeat a specific order's pattern
}

/**
 * Calculate average daily consumption from historical logs.
 * Groups by productId and computes mean daily consumption across the period.
 */
export function calculateAvgDailyConsumption(
  logs: ConsumptionLog[],
  productId: string,
  periodMonths: number,
): { avgDaily: number; totalConsumed: number; daysWithConsumption: number } {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  const cutoffISO = cutoffDate.toISOString().split('T')[0];

  // Filter logs within period
  const relevantLogs = logs.filter(log => {
    const logDay = log.day || (log.createdAtISO ? log.createdAtISO.split('T')[0] : '');
    return logDay >= cutoffISO;
  });

  // Sum consumption for this product
  let totalConsumed = 0;
  const daysWithConsumption = new Set<string>();

  relevantLogs.forEach(log => {
    const logDay = log.day || (log.createdAtISO ? log.createdAtISO.split('T')[0] : '');
    log.entries.forEach(entry => {
      if (entry.productId === productId && entry.consumed > 0) {
        totalConsumed += entry.consumed;
        daysWithConsumption.add(logDay);
      }
    });
  });

  // Calculate days in period (from cutoff to now)
  const now = new Date();
  const totalDaysInPeriod = Math.max(1, Math.floor((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Average daily consumption across ALL days in period (not just days with consumption)
  const avgDaily = totalDaysInPeriod > 0 ? totalConsumed / totalDaysInPeriod : 0;

  return { avgDaily, totalConsumed, daysWithConsumption: daysWithConsumption.size };
}

/**
 * Generate consumption-based suggestions for stock ordering.
 * Replaces random estimation with historical data-driven logic.
 */
export function generateConsumptionBasedSuggestions(
  products: Product[],
  logs: ConsumptionLog[],
  params: SuggestionParams,
  supplierProductIds?: string[],
): ConsumptionBasedSuggestion[] {
  const multiplier = params.dateType === 'after' ? 1.5 : 1;
  const daysToCover = params.dateType === 'after' ? 14 : 7; // days of stock to order for

  const filteredProducts = supplierProductIds
    ? products.filter(p => supplierProductIds.includes(p.id))
    : products;

  // If a specific date is provided, try to repeat that day's consumption pattern
  if (params.specificDate) {
    const specificLog = logs.find(log => {
      const logDay = log.day || (log.createdAtISO ? log.createdAtISO.split('T')[0] : '');
      return logDay === params.specificDate;
    });

    if (specificLog) {
      return filteredProducts.map(product => {
        const currentStock = product.stockByWarehouse.reduce((sum, s) => sum + s.quantity, 0);
        const consumedInLog = specificLog.entries
          .filter(e => e.productId === product.id)
          .reduce((sum, e) => sum + e.consumed, 0);

        const suggested = Math.max(0, Math.ceil(consumedInLog * multiplier) - currentStock);
        const rounded = roundUpToOrderUnit(suggested, (product as Product).orderUnit);

        return {
          productId: product.id,
          productName: product.name,
          currentStock,
          avgDailyConsumption: consumedInLog,
          totalConsumedInPeriod: consumedInLog,
          daysInPeriod: 1,
          suggestedQuantity: rounded,
          unit: product.unit,
          orderUnit: (product as Product).orderUnit,
        };
      });
    }
  }

  // Default: use historical average
  return filteredProducts.map(product => {
    const currentStock = product.stockByWarehouse.reduce((sum, s) => sum + s.quantity, 0);
    const { avgDaily, totalConsumed, daysWithConsumption } = calculateAvgDailyConsumption(
      logs,
      product.id,
      params.periodMonths,
    );

    // If no historical data, fall back to a minimal suggestion
    const avgWithMultiplier = avgDaily > 0 ? avgDaily * multiplier : 0;
    const rawSuggested = Math.max(0, Math.ceil(avgWithMultiplier * daysToCover) - currentStock);
    const suggested = roundUpToOrderUnit(rawSuggested, (product as Product).orderUnit);

    return {
      productId: product.id,
      productName: product.name,
      currentStock,
      avgDailyConsumption: Math.round(avgDaily * 100) / 100,
      totalConsumedInPeriod: totalConsumed,
      daysInPeriod: daysWithConsumption,
      suggestedQuantity: suggested,
      unit: product.unit,
      orderUnit: (product as Product).orderUnit,
    };
  });
}

/**
 * Round up to order unit multiples (pack sizes).
 */
function roundUpToOrderUnit(quantity: number, orderUnit?: number): number {
  if (!orderUnit || orderUnit <= 1) return Math.max(0, quantity);
  if (quantity <= 0) return 0;
  return Math.ceil(quantity / orderUnit) * orderUnit;
}

// --- Kitchen order lifecycle ---

/**
 * Create kitchen orders from a sales ticket.
 * Splits ticket items by kitchen and creates separate orders per kitchen.
 */
export function createKitchenOrdersFromTicket(
  ticket: SalesTicket,
  salesProducts: SalesProduct[],
  kitchens: { id: string; name: string }[],
  tableId?: string,
  tableName?: string,
): KitchenOrder[] {
  const salesMap = new Map(salesProducts.map(p => [p.id, p]));
  const kitchenMap = new Map(kitchens.map(k => [k.id, k]));

  // Group items by kitchen
  const byKitchen: Record<string, { salesProductId: string; name: string; quantity: number; emoji: string }[]> = {};

  ticket.items.forEach(item => {
    const sp = salesMap.get(item.salesProductId);
    if (!sp) return;
    const kitchenId = sp.kitchenId || item.kitchenId;
    if (!kitchenId) return;

    if (!byKitchen[kitchenId]) byKitchen[kitchenId] = [];
    const existing = byKitchen[kitchenId].find(i => i.salesProductId === item.salesProductId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      byKitchen[kitchenId].push({
        salesProductId: item.salesProductId,
        name: item.name,
        quantity: item.quantity,
        emoji: sp.emoji || '🍽️',
      });
    }
  });

  const now = new Date().toISOString();

  return Object.entries(byKitchen).map(([kitchenId, items]) => {
    const kitchen = kitchenMap.get(kitchenId);
    return {
      id: `ko-${Date.now()}-${kitchenId}`,
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      kitchenId,
      kitchenName: kitchen?.name || kitchenId,
      items,
      status: 'pending' as KitchenOrderStatus,
      createdAtISO: now,
      updatedAtISO: now,
      operatorName: ticket.operatorName,
      tableId,
      tableName,
    };
  });
}

/**
 * Transition a kitchen order to the next status.
 */
export function transitionKitchenOrder(
  order: KitchenOrder,
  nextStatus: KitchenOrderStatus,
): KitchenOrder {
  const validTransitions: Record<KitchenOrderStatus, KitchenOrderStatus[]> = {
    pending: ['preparing'],
    preparing: ['ready'],
    ready: ['delivered'],
    delivered: [], // terminal state
  };

  const allowed = validTransitions[order.status];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Invalid transition: ${order.status} -> ${nextStatus}`);
  }

  return {
    ...order,
    status: nextStatus,
    updatedAtISO: new Date().toISOString(),
  };
}
