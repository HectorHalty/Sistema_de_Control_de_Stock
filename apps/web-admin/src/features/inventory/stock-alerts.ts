import type { Order, Product, StockMovement } from '@/app/components/store';
import { calculateAvgDailyDemandFromMovements } from '@/features/kitchen/domain';

export type StockAlert = {
  product: Product;
  weeklyAvg: number;
  current: number;
  pending: number;
};

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
    .map(product => {
      const weeklyAvg = weeklyAverageDemand(movements, product.id);
      const current = productStockTotal(product);
      const pending = pendingOrderQuantity(orders, product.id);
      return { product, weeklyAvg, current, pending };
    })
    .filter(({ weeklyAvg, current, pending }) => weeklyAvg > 0 && current + pending < weeklyAvg);
}
