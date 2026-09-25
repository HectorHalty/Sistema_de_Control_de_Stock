import type { Order, Product, StockMovement } from '@/app/components/store';
import { calculateAvgDailyDemandFromMovements } from '@/features/kitchen/domain';

export type StockAlert = {
  product: Product;
  weeklyAvg: number;
  current: number;
  pending: number;
};

const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';

const WEEKDAY_BY_ENGLISH: Record<string, string> = {
  Sunday: 'Domingo',
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miercoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sabado',
};

export const DEFAULT_AUTO_ALERT_MINIMUM = 20;

export function normalizeAutoAlertMinimum(value: unknown): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_AUTO_ALERT_MINIMUM;
  return Math.floor(numeric);
}

export function weekdayNameInArgentina(date: Date): string {
  const english = new Intl.DateTimeFormat('en-US', {
    timeZone: ARGENTINA_TZ,
    weekday: 'long',
  }).format(date);
  return WEEKDAY_BY_ENGLISH[english] ?? '';
}

export function isAlertDay(today: Date, alertDay: string): boolean {
  return weekdayNameInArgentina(today) === alertDay;
}

export function pendingOrderQuantity(orders: Order[], productId: string): number {
  return orders
    .filter(order => order.status === 'Pendiente')
    .reduce((sum, order) => {
      const item = order.items.find(i => i.productId === productId);
      return sum + (item?.quantityOrdered || 0);
    }, 0);
}

export function weeklyAverageDemand(movements: StockMovement[], productId: string): number {
  const { avgDaily } = calculateAvgDailyDemandFromMovements(movements, productId, 1);
  return Math.ceil(avgDaily * 7);
}

export function productStockTotal(product: Product): number {
  return product.stockByWarehouse.reduce((sum, stock) => sum + stock.quantity, 0);
}

export function getStockAlertProducts(
  products: Product[],
  orders: Order[],
  movements: StockMovement[],
): StockAlert[] {
  return products
    .map(product => toStockAlert(product, orders, movements))
    .filter(({ weeklyAvg, current, pending }) => weeklyAvg > 0 && current + pending < weeklyAvg);
}

function toStockAlert(product: Product, orders: Order[], movements: StockMovement[]): StockAlert {
  return {
    product,
    weeklyAvg: weeklyAverageDemand(movements, product.id),
    current: productStockTotal(product),
    pending: pendingOrderQuantity(orders, product.id),
  };
}

export function selectStockAlerts(input: {
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
  lowStockNotifications: boolean;
  autoAlerts: boolean;
  autoAlertMinimum: number;
  alertDay: string;
  today?: Date;
}): StockAlert[] {
  const today = input.today ?? new Date();
  const weekly = input.lowStockNotifications && isAlertDay(today, input.alertDay)
    ? getStockAlertProducts(input.products, input.orders, input.movements)
    : [];

  const byId = new Map<string, StockAlert>();
  for (const alert of weekly) byId.set(alert.product.id, alert);

  if (input.autoAlerts) {
    const minimum = normalizeAutoAlertMinimum(input.autoAlertMinimum);
    for (const product of input.products) {
      if (byId.has(product.id)) continue;
      const current = productStockTotal(product);
      if (current >= minimum) continue;
      byId.set(product.id, toStockAlert(product, input.orders, input.movements));
    }
  }

  return [...byId.values()];
}
