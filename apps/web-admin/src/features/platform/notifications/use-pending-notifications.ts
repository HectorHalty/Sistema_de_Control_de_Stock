import { useMemo } from 'react';
import { useAppContext } from '@/app/providers/AppContext';
import { canAccessModule } from '@/features/platform/config/modules';
import { sortOrdersByDateDesc } from '@/features/inventory/sort-orders';
import { getStockAlertProducts } from '@/features/inventory/stock-alerts';
import { getUnitLabel } from '@/app/components/store';
import type { AppNotification } from './types';

const MAX_LOW_STOCK_ITEMS = 5;

export function usePendingNotifications(): AppNotification[] {
  const {
    currentUser,
    products,
    orders,
    kitchenOrders,
    stockMovements,
    notificationsEnabled,
    stockLowNotifications,
  } = useAppContext();

  return useMemo(() => {
    if (!notificationsEnabled) return [];

    const items: AppNotification[] = [];
    const canSeeStock = canAccessModule(currentUser.role, 'stock');
    const canSeeVentas = canAccessModule(currentUser.role, 'ventas');

    if (canSeeStock && stockLowNotifications) {
      const lowStock = getStockAlertProducts(products, orders, stockMovements).slice(0, MAX_LOW_STOCK_ITEMS);

      for (const { product, current } of lowStock) {
        items.push({
          id: `low-stock-${product.id}`,
          kind: 'low_stock',
          title: 'Stock bajo',
          description: `${product.name}: ${current} ${getUnitLabel(product.unit, true)} restantes`,
          href: '/reportes?tab=alertas',
          severity: current < 10 ? 'error' : 'warning',
        });
      }
    }

    if (canSeeStock) {
      const pendingOrders = sortOrdersByDateDesc(
        orders.filter(order => order.status === 'Pendiente'),
      );
      for (const order of pendingOrders) {
        items.push({
          id: `order-${order.id}`,
          kind: 'pending_order',
          title: 'Pedido pendiente',
          description: `${order.provider} · ${order.items.length} producto(s) · ${order.date}`,
          href: '/pedidos',
          severity: 'info',
        });
      }
    }

    if (canSeeVentas) {
      const activeKitchen = kitchenOrders.filter(
        order => order.status === 'pending' || order.status === 'preparing',
      );
      for (const order of activeKitchen) {
        const statusLabel = order.status === 'pending' ? 'Pendiente' : 'En preparación';
        items.push({
          id: `kitchen-${order.id}`,
          kind: 'kitchen_order',
          title: `Cocina · Ticket #${order.ticketNumber}`,
          description: `${order.kitchenName} · ${statusLabel} · ${order.items.length} ítem(s)`,
          href: '/ventas?tab=mostrador',
          severity: order.status === 'pending' ? 'warning' : 'info',
        });
      }
    }

    const severityRank: Record<AppNotification['severity'], number> = {
      error: 0,
      warning: 1,
      info: 2,
    };

    return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  }, [
    currentUser.role,
    products,
    orders,
    kitchenOrders,
    stockMovements,
    notificationsEnabled,
    stockLowNotifications,
  ]);
}
