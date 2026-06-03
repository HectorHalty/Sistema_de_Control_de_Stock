import {
  addDays,
  endOfDay,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { SalesTicket } from '@/app/components/store';

export type MetricsRange = '7d' | '30d' | '90d' | 'Año';

export const KITCHEN_CHART_COLORS: Record<string, string> = {
  Parrilla: '#f97316',
  Barra: '#0ea5e9',
  Cervecería: '#f59e0b',
  Cocina: '#10b981',
  'Sin cocina': '#94a3b8',
};

export const CHART_PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

function rangeToDays(range: MetricsRange): number {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return 365;
}

export function isLocalOnlyTicketId(id: string): boolean {
  return id.startsWith('sale-') || id.startsWith('return-');
}

export function getIssuedSales(tickets: SalesTicket[]): SalesTicket[] {
  return tickets.filter(t => t.status === 'emitido');
}

export function filterTicketsInRange(
  tickets: SalesTicket[],
  range: MetricsRange,
): SalesTicket[] {
  const days = rangeToDays(range);
  const from = startOfDay(subDays(new Date(), days - 1));
  const to = endOfDay(new Date());

  return getIssuedSales(tickets).filter(t => {
    try {
      const d = parseISO(t.createdAtISO);
      return isWithinInterval(d, { start: from, end: to });
    } catch {
      return false;
    }
  });
}

export function filterTicketsToday(tickets: SalesTicket[]): SalesTicket[] {
  const today = new Date();
  return getIssuedSales(tickets).filter(t => {
    try {
      return isSameDay(parseISO(t.createdAtISO), today);
    } catch {
      return false;
    }
  });
}

export function filterTicketsByDateRange(
  tickets: SalesTicket[],
  dateFrom: string,
  dateTo: string,
): SalesTicket[] {
  const from = startOfDay(parseISO(dateFrom));
  const to = endOfDay(parseISO(dateTo));

  return getIssuedSales(tickets).filter(t => {
    try {
      const d = parseISO(t.createdAtISO);
      return isWithinInterval(d, { start: from, end: to });
    } catch {
      return false;
    }
  });
}

export type SalesByDayPoint = { day: string; ventas: number; tickets: number; id: string };
export type TopProductPoint = { name: string; value: number; revenue: number; id: string };

export type KitchenTopProducts = {
  kitchen: string;
  id: string;
  color: string;
  products: TopProductPoint[];
  totalUnits: number;
  totalRevenue: number;
};

export type EmployeeDayStat = {
  id: string;
  name: string;
  tickets: number;
  totalVentas: number;
  unitsSold: number;
};

export type DashboardMetrics = {
  totalVentas: number;
  ventasHoy: number;
  ticketsCount: number;
  ticketsHoy: number;
  ticketPromedio: number;
  salesByDay: SalesByDayPoint[];
  topProductsByKitchen: KitchenTopProducts[];
  employeesToday: EmployeeDayStat[];
};

export function computeDashboardMetrics(
  tickets: SalesTicket[],
  range: MetricsRange,
  resolveKitchen: (productId: string, kitchenId: string) => string,
): DashboardMetrics {
  const inRange = filterTicketsInRange(tickets, range);
  const todayTickets = filterTicketsToday(tickets);
  const days = rangeToDays(range);
  const from = startOfDay(subDays(new Date(), days - 1));
  const to = endOfDay(new Date());

  const totalVentas = inRange.reduce((s, t) => s + t.total, 0);
  const ventasHoy = todayTickets.reduce((s, t) => s + t.total, 0);
  const ticketsCount = inRange.length;
  const ticketsHoy = todayTickets.length;
  const ticketPromedio = ticketsCount > 0 ? Math.round(totalVentas / ticketsCount) : 0;

  const salesByDay: SalesByDayPoint[] = [];
  let cursor = from;
  let i = 0;
  while (cursor <= to) {
    const dayTickets = inRange.filter(t => {
      const d = parseISO(t.createdAtISO);
      return (
        d.getFullYear() === cursor.getFullYear() &&
        d.getMonth() === cursor.getMonth() &&
        d.getDate() === cursor.getDate()
      );
    });
    salesByDay.push({
      id: `day-${i}`,
      day:
        range === '7d'
          ? format(cursor, 'EEE', { locale: es })
          : format(cursor, 'dd/MM', { locale: es }),
      ventas: dayTickets.reduce((s, t) => s + t.total, 0),
      tickets: dayTickets.length,
    });
    cursor = addDays(cursor, 1);
    i += 1;
  }

  const kitchenMap = new Map<
    string,
    Map<string, { name: string; qty: number; revenue: number }>
  >();

  for (const ticket of inRange) {
    for (const item of ticket.items) {
      const kitchen = resolveKitchen(item.salesProductId, item.kitchenId);
      if (!kitchenMap.has(kitchen)) kitchenMap.set(kitchen, new Map());
      const productsMap = kitchenMap.get(kitchen)!;
      const prev = productsMap.get(item.salesProductId) ?? {
        name: item.name,
        qty: 0,
        revenue: 0,
      };
      productsMap.set(item.salesProductId, {
        name: item.name,
        qty: prev.qty + item.quantity,
        revenue: prev.revenue + item.unitPrice * item.quantity,
      });
    }
  }

  const topProductsByKitchen: KitchenTopProducts[] = [...kitchenMap.entries()]
    .map(([kitchen, productsMap]) => {
      const allProducts: TopProductPoint[] = [...productsMap.entries()]
        .map(([id, p]) => ({
          id: `${kitchen}-${id}`,
          name: p.name,
          value: p.qty,
          revenue: p.revenue,
        }))
        .sort((a, b) => b.value - a.value);

      const products = allProducts.slice(0, 5);
      const totalUnits = allProducts.reduce((s, p) => s + p.value, 0);
      const totalRevenue = allProducts.reduce((s, p) => s + p.revenue, 0);

      return {
        kitchen,
        id: `kitchen-${kitchen}`,
        color: KITCHEN_CHART_COLORS[kitchen] ?? CHART_PALETTE[0],
        products,
        totalUnits,
        totalRevenue,
      };
    })
    .sort((a, b) => b.totalUnits - a.totalUnits);

  const employeeMap = new Map<string, EmployeeDayStat>();
  for (const ticket of todayTickets) {
    const key = ticket.operatorId || ticket.operatorName;
    const prev = employeeMap.get(key) ?? {
      id: key,
      name: ticket.operatorName || ticket.operatorId,
      tickets: 0,
      totalVentas: 0,
      unitsSold: 0,
    };
    employeeMap.set(key, {
      ...prev,
      tickets: prev.tickets + 1,
      totalVentas: prev.totalVentas + ticket.total,
      unitsSold: prev.unitsSold + ticket.items.reduce((s, i) => s + i.quantity, 0),
    });
  }

  const employeesToday = [...employeeMap.values()].sort(
    (a, b) => b.totalVentas - a.totalVentas,
  );

  return {
    totalVentas,
    ventasHoy,
    ticketsCount,
    ticketsHoy,
    ticketPromedio,
    salesByDay,
    topProductsByKitchen,
    employeesToday,
  };
}
