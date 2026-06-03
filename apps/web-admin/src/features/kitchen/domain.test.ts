import { describe, expect, it } from 'vitest';
import {
  calculateAvgDailyConsumption,
  generateConsumptionBasedSuggestions,
  createKitchenOrdersFromTicket,
  transitionKitchenOrder,
} from './domain';
import type { ConsumptionLog, Product, SalesTicket, SalesProduct, Kitchen } from '@/app/components/store';

const sampleProducts: Product[] = [
  {
    id: 'p1', name: 'Coca-Cola 500ml', code: 'BEB-001', description: '', category: 'Bebidas',
    unit: 'unidades', image: '', orderUnit: 24,
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 120 }],
  },
  {
    id: 'p2', name: 'Agua Mineral 500ml', code: 'BEB-002', description: '', category: 'Bebidas',
    unit: 'unidades', image: '',
    stockByWarehouse: [{ warehouseId: 'w1', quantity: 200 }],
  },
];

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const twoDaysAgo = new Date(today);
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

const sampleLogs: ConsumptionLog[] = [
  {
    id: 'log1', date: yesterday.toLocaleDateString('es-AR'), day: yesterday.toISOString().split('T')[0],
    createdAtISO: yesterday.toISOString(), dateType: 'regular',
    entries: [
      { productId: 'p1', productName: 'Coca-Cola 500ml', warehouseId: 'w1', warehouseName: 'Depósito', previousStock: 130, newStock: 120, consumed: 10, unit: 'unidades' },
      { productId: 'p2', productName: 'Agua Mineral 500ml', warehouseId: 'w1', warehouseName: 'Depósito', previousStock: 210, newStock: 200, consumed: 10, unit: 'unidades' },
    ],
  },
  {
    id: 'log2', date: twoDaysAgo.toLocaleDateString('es-AR'), day: twoDaysAgo.toISOString().split('T')[0],
    createdAtISO: twoDaysAgo.toISOString(), dateType: 'regular',
    entries: [
      { productId: 'p1', productName: 'Coca-Cola 500ml', warehouseId: 'w1', warehouseName: 'Depósito', previousStock: 150, newStock: 130, consumed: 20, unit: 'unidades' },
    ],
  },
];

describe('kitchen/domain - calculateAvgDailyConsumption', () => {
  it('calculates average daily consumption from logs', () => {
    const result = calculateAvgDailyConsumption(sampleLogs, 'p1', 1);
    // Total consumed: 30 over ~2 days
    expect(result.totalConsumed).toBe(30);
    expect(result.daysWithConsumption).toBe(2);
    expect(result.avgDaily).toBeGreaterThan(0);
  });

  it('returns zero when no logs exist for product', () => {
    const result = calculateAvgDailyConsumption(sampleLogs, 'nonexistent', 1);
    expect(result.totalConsumed).toBe(0);
    expect(result.avgDaily).toBe(0);
  });

  it('only counts consumed entries (positive consumption)', () => {
    const logsWithRestock: ConsumptionLog[] = [
      {
        id: 'log3', date: today.toISOString().split('T')[0], day: today.toISOString().split('T')[0],
        createdAtISO: today.toISOString(), dateType: 'regular',
        entries: [
          { productId: 'p1', productName: 'Coca-Cola', warehouseId: 'w1', warehouseName: 'Depósito', previousStock: 100, newStock: 120, consumed: -20, unit: 'unidades' },
        ],
      },
    ];
    const result = calculateAvgDailyConsumption(logsWithRestock, 'p1', 1);
    expect(result.totalConsumed).toBe(0);
  });
});

describe('kitchen/domain - generateConsumptionBasedSuggestions', () => {
  it('generates suggestions based on historical consumption', () => {
    const suggestions = generateConsumptionBasedSuggestions(sampleProducts, sampleLogs, {
      dateType: 'regular',
      periodMonths: 1,
    });

    const cocaSuggestion = suggestions.find(s => s.productId === 'p1');
    expect(cocaSuggestion).toBeDefined();
    expect(cocaSuggestion!.totalConsumedInPeriod).toBe(30);
    expect(cocaSuggestion!.suggestedQuantity).toBeGreaterThanOrEqual(0);
  });

  it('applies multiplier for after/special events', () => {
    const regular = generateConsumptionBasedSuggestions(sampleProducts, sampleLogs, {
      dateType: 'regular',
      periodMonths: 1,
    });
    const after = generateConsumptionBasedSuggestions(sampleProducts, sampleLogs, {
      dateType: 'after',
      periodMonths: 1,
    });

    const cocaRegular = regular.find(s => s.productId === 'p1')!;
    const cocaAfter = after.find(s => s.productId === 'p1')!;

    // After should suggest more (1.5x multiplier)
    expect(cocaAfter.suggestedQuantity).toBeGreaterThanOrEqual(cocaRegular.suggestedQuantity);
  });

  it('filters by supplier product IDs when provided', () => {
    const suggestions = generateConsumptionBasedSuggestions(sampleProducts, sampleLogs, {
      dateType: 'regular',
      periodMonths: 1,
    }, ['p1']); // Only p1

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].productId).toBe('p1');
  });

  it('uses specific date pattern when provided and log exists', () => {
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const suggestions = generateConsumptionBasedSuggestions(sampleProducts, sampleLogs, {
      dateType: 'regular',
      periodMonths: 1,
      specificDate: yesterdayStr,
    });

    const cocaSuggestion = suggestions.find(s => s.productId === 'p1');
    // Should use the specific day's consumption (10) as base
    expect(cocaSuggestion).toBeDefined();
    expect(cocaSuggestion!.totalConsumedInPeriod).toBe(10);
  });

  it('falls back to historical average when specific date has no log', () => {
    const suggestions = generateConsumptionBasedSuggestions(sampleProducts, sampleLogs, {
      dateType: 'regular',
      periodMonths: 1,
      specificDate: '2020-01-01', // No log for this date
    });

    const cocaSuggestion = suggestions.find(s => s.productId === 'p1');
    expect(cocaSuggestion).toBeDefined();
    // Falls back to historical average, not zero
    expect(cocaSuggestion!.totalConsumedInPeriod).toBe(30);
  });

  it('rounds up to order unit multiples', () => {
    const suggestions = generateConsumptionBasedSuggestions(sampleProducts, sampleLogs, {
      dateType: 'regular',
      periodMonths: 1,
    });

    const cocaSuggestion = suggestions.find(s => s.productId === 'p1');
    // p1 has orderUnit: 24, so suggestion should be multiple of 24
    if (cocaSuggestion!.suggestedQuantity > 0) {
      expect(cocaSuggestion!.suggestedQuantity % 24).toBe(0);
    }
  });
});

describe('kitchen/domain - createKitchenOrdersFromTicket', () => {
  const sampleSalesProducts: SalesProduct[] = [
    {
      id: 'sp-coca', name: 'Coca-Cola 500ml', category: 'Bebidas',
      kitchenId: 'k-cerveceria', price: 2900, emoji: '🥤', active: true,
      recipe: [{ stockProductId: 'p1', quantity: 1 }],
    },
    {
      id: 'sp-hamburguesa', name: 'Hamburguesa Simple', category: 'Comidas',
      kitchenId: 'k-parrilla', price: 5200, emoji: '🍔', active: true,
      recipe: [{ stockProductId: 'p11', quantity: 1 }],
    },
  ];

  const sampleKitchens: Kitchen[] = [
    { id: 'k-cerveceria', name: 'Cervecería', emoji: '🍺', active: true },
    { id: 'k-parrilla', name: 'Parrilla', emoji: '🔥', active: true },
  ];

  const sampleTicket: SalesTicket = {
    id: 'ticket-1', number: 1001, createdAtISO: new Date().toISOString(),
    status: 'emitido',
    items: [
      { salesProductId: 'sp-coca', name: 'Coca-Cola 500ml', unitPrice: 2900, quantity: 2, kitchenId: 'k-cerveceria' },
      { salesProductId: 'sp-hamburguesa', name: 'Hamburguesa Simple', unitPrice: 5200, quantity: 1, kitchenId: 'k-parrilla' },
    ],
    total: 11000, operatorId: 'admin', operatorName: 'Admin',
  };

  it('creates separate kitchen orders per kitchen', () => {
    const orders = createKitchenOrdersFromTicket(sampleTicket, sampleSalesProducts, sampleKitchens);
    expect(orders).toHaveLength(2);
    expect(orders.some(o => o.kitchenId === 'k-cerveceria')).toBe(true);
    expect(orders.some(o => o.kitchenId === 'k-parrilla')).toBe(true);
  });

  it('includes correct items per kitchen order', () => {
    const orders = createKitchenOrdersFromTicket(sampleTicket, sampleSalesProducts, sampleKitchens);
    const cerveceriaOrder = orders.find(o => o.kitchenId === 'k-cerveceria')!;
    expect(cerveceriaOrder.items).toHaveLength(1);
    expect(cerveceriaOrder.items[0].name).toBe('Coca-Cola 500ml');
    expect(cerveceriaOrder.items[0].quantity).toBe(2);
  });

  it('sets initial status to pending', () => {
    const orders = createKitchenOrdersFromTicket(sampleTicket, sampleSalesProducts, sampleKitchens);
    orders.forEach(o => expect(o.status).toBe('pending'));
  });

  it('includes table context when provided', () => {
    const orders = createKitchenOrdersFromTicket(sampleTicket, sampleSalesProducts, sampleKitchens, 't1', 'Mesa 1');
    orders.forEach(o => {
      expect(o.tableId).toBe('t1');
      expect(o.tableName).toBe('Mesa 1');
    });
  });
});

describe('kitchen/domain - transitionKitchenOrder', () => {
  const baseOrder = {
    id: 'ko-1', ticketId: 'ticket-1', ticketNumber: 1001,
    kitchenId: 'k-parrilla', kitchenName: 'Parrilla',
    items: [{ salesProductId: 'sp1', name: 'Burger', quantity: 1, emoji: '🍔' }],
    status: 'pending' as const,
    createdAtISO: new Date().toISOString(),
    updatedAtISO: new Date().toISOString(),
    operatorName: 'Admin',
  };

  it('transitions pending -> preparing', () => {
    const updated = transitionKitchenOrder(baseOrder, 'preparing');
    expect(updated.status).toBe('preparing');
    expect(updated.updatedAtISO).not.toBe(baseOrder.updatedAtISO);
  });

  it('transitions preparing -> ready', () => {
    const preparing = { ...baseOrder, status: 'preparing' as const };
    const updated = transitionKitchenOrder(preparing, 'ready');
    expect(updated.status).toBe('ready');
  });

  it('transitions ready -> delivered', () => {
    const ready = { ...baseOrder, status: 'ready' as const };
    const updated = transitionKitchenOrder(ready, 'delivered');
    expect(updated.status).toBe('delivered');
  });

  it('throws on invalid transition', () => {
    expect(() => transitionKitchenOrder(baseOrder, 'ready')).toThrow('Invalid transition');
  });

  it('throws on delivered transition (terminal state)', () => {
    const delivered = { ...baseOrder, status: 'delivered' as const };
    expect(() => transitionKitchenOrder(delivered, 'pending')).toThrow('Invalid transition');
  });
});
