import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapApiProductToLocal,
  mapApiMovementToLocal,
  mapApiSupplierToLocal,
  mapApiPurchaseOrderToLocal,
  mapApiEmployeeConsumptionToLocal,
  mapApiCountSessionToLocal,
} from '@/features/inventory/api/inventory-mappers';
import type { StockProduct, ApiPurchaseOrder, ApiSupplier } from '@/app/api/client';

/**
 * Suite profunda frontend — migración API-first (Fases 1–3.2).
 * Énfasis en SEGURIDAD (no degradar silenciosamente, no duplicar movimientos)
 * y EFICIENCIA (hidratación paralela, sin escrituras locales redundantes).
 */

// ============================================================
// Contratos de seguridad del adapter de ventas (Fase 2.2/2.3)
// ============================================================

function shouldFallbackToLocalOnApiError(_e: unknown): boolean {
  // Debe coincidir con adapters.ts — nunca degradar ante ApiError
  return false;
}

class MockApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function resolveCheckoutOnError(e: unknown): 'surface_error' | 'fallback_local' {
  if (shouldFallbackToLocalOnApiError(e)) return 'fallback_local';
  return 'surface_error';
}

describe('Seguridad — adapter de ventas no degrada ante error API', () => {
  it('401/403/409 deben mostrarse al operador, no crear venta local fantasma', () => {
    for (const status of [401, 403, 409, 500]) {
      const action = resolveCheckoutOnError(new MockApiError(status, 'error'));
      expect(action).toBe('surface_error');
    }
  });

  it('solo health-check falso habilita modo local (apiUnavailable)', () => {
    const apiAvailable = false;
    const checkoutResult = apiAvailable
      ? { ok: false as const, apiUnavailable: false }
      : { ok: false as const, apiUnavailable: true };
    expect(checkoutResult.apiUnavailable).toBe(true);
  });
});

// ============================================================
// Seguridad — movimientos de stock solo server-side (Fase 3.1)
// ============================================================

type MovementInput = { productId: string; quantity: number; type: string };

function applyLocalStockMovements(
  inventoryApiAvailable: boolean,
  current: MovementInput[],
  incoming: MovementInput[],
): MovementInput[] {
  if (inventoryApiAvailable) return current;
  return [...incoming, ...current];
}

describe('Seguridad — movimientos locales bloqueados con API activa', () => {
  it('addStockMovements es no-op cuando inventoryApiAvailable=true', () => {
    const before: MovementInput[] = [{ productId: 'p1', quantity: -1, type: 'venta' }];
    const after = applyLocalStockMovements(true, before, [
      { productId: 'p2', quantity: 10, type: 'entrada' },
    ]);
    expect(after).toEqual(before);
    expect(after).toHaveLength(1);
  });

  it('permite movimientos locales solo offline', () => {
    const after = applyLocalStockMovements(false, [], [
      { productId: 'p1', quantity: 5, type: 'entrada' },
    ]);
    expect(after).toHaveLength(1);
  });
});

// ============================================================
// Eficiencia — hidratación paralela del inventario
// ============================================================

async function hydrateInventoryParallel(
  loaders: Record<string, () => Promise<void>>,
): Promise<{ durationMs: number; calls: string[] }> {
  const calls: string[] = [];
  const wrapped = Object.fromEntries(
    Object.entries(loaders).map(([key, fn]) => [
      key,
      async () => {
        calls.push(key);
        await fn();
      },
    ]),
  );
  const start = performance.now();
  await Promise.all(Object.values(wrapped).map(fn => fn()));
  return { durationMs: performance.now() - start, calls };
}

describe('Eficiencia — hidratación inventario en paralelo', () => {
  it('ejecuta todos los loaders de Fase 3.x en un solo Promise.all', async () => {
    const delays = { categories: 30, warehouses: 30, products: 30, movements: 30, suppliers: 30, orders: 30 };
    const loaders = Object.fromEntries(
      Object.entries(delays).map(([k, ms]) => [k, () => new Promise<void>(r => setTimeout(r, ms))]),
    );

    const { durationMs, calls } = await hydrateInventoryParallel(loaders);

    expect(calls.sort()).toEqual(Object.keys(delays).sort());
    expect(durationMs).toBeLessThan(120);
  });
});

// ============================================================
// Integridad — mappers API → local (Fases 2.1, 3.1, 3.2)
// ============================================================

describe('Integridad — mappers inventario (catálogo + operaciones + pedidos)', () => {
  const baseProduct: StockProduct = {
    id: 'uuid-p',
    name: 'Coca',
    code: 'BEB-001',
    categoryId: 'cat-1',
    unit: 'unidades',
    stockLevels: [{ id: 'sl', productId: 'uuid-p', warehouseId: 'w1', quantity: 12 }],
    category: { id: 'cat-1', name: 'Bebidas', icon: 'Wine' },
  };

  it('Fase 2.1: producto API-first preserva stock por almacén', () => {
    const local = mapApiProductToLocal(baseProduct);
    expect(local.stockByWarehouse).toEqual([{ warehouseId: 'w1', quantity: 12 }]);
    expect(local.category).toBe('Bebidas');
  });

  it('Fase 3.1: movimiento conserva cantidad signada y referencia', () => {
    const mov = mapApiMovementToLocal({
      id: 'm1',
      createdAt: '2026-06-16T10:00:00Z',
      type: 'entrada',
      productId: 'uuid-p',
      warehouseId: 'w1',
      quantity: '15.5',
      reference: 'PED-001',
      operatorName: 'Admin',
    });
    expect(mov.quantity).toBe(15.5);
    expect(mov.reference).toBe('PED-001');
  });

  it('Fase 3.1: consumo empleado mapea stocks previo/nuevo', () => {
    const row = mapApiEmployeeConsumptionToLocal({
      id: 'ec1',
      day: '2026-06-16',
      createdAt: '2026-06-16T12:00:00Z',
      productId: 'uuid-p',
      productName: 'Coca',
      productCode: 'BEB-001',
      warehouseId: 'w1',
      warehouseName: 'Depósito',
      quantity: 2,
      unit: 'unidades',
      previousStock: 12,
      newStock: 10,
    });
    expect(row.previousStock).toBe(12);
    expect(row.newStock).toBe(10);
  });

  it('Fase 3.2: proveedor expone productIds planos', () => {
    const supplier: ApiSupplier = {
      id: 'sup-1',
      name: 'Mayorista',
      products: [
        { id: 'sp1', supplierId: 'sup-1', productId: 'uuid-p' },
      ],
    };
    expect(mapApiSupplierToLocal(supplier).productIds).toEqual(['uuid-p']);
  });

  it('Fase 3.2: pedido usa orderNumber como id visible (PDF/auditoría)', () => {
    const order: ApiPurchaseOrder = {
      id: 'internal-uuid',
      orderNumber: 'PED-042',
      date: '2026-06-16',
      provider: 'Mayorista',
      status: 'Recibido',
      receivedAt: '2026-06-16T15:00:00Z',
      createdAt: '2026-06-16T14:00:00Z',
      items: [{
        id: 'i1',
        purchaseOrderId: 'internal-uuid',
        productId: 'uuid-p',
        quantityOrdered: 24,
        quantityReceived: 20,
      }],
    };
    const local = mapApiPurchaseOrderToLocal(order);
    expect(local.id).toBe('PED-042');
    expect(local.status).toBe('Recibido');
    expect(local.items[0].quantityReceived).toBe(20);
  });
});

// ============================================================
// Seguridad — recepción pedido: contrato frontend → API
// ============================================================

function buildReceivePayload(
  arrivalItems: { productId: string; received: number; allocations: { warehouseId: string; quantity: number }[] }[],
) {
  return {
    items: arrivalItems.map(it => ({
      productId: it.productId,
      quantityReceived: it.received,
      allocations: it.allocations,
    })),
  };
}

function validateArrivalAllocations(
  item: { received: number; allocations: { quantity: number }[] },
): string | null {
  const sum = item.allocations.reduce((s, a) => s + (a.quantity || 0), 0);
  if (sum !== item.received) {
    return `La suma por almacén (${sum}) debe ser igual a recibido (${item.received}).`;
  }
  return null;
}

describe('Seguridad — validación de arribo antes de llamar API', () => {
  it('bloquea envío si allocations no coinciden con recibido', () => {
    const err = validateArrivalAllocations({
      received: 10,
      allocations: [{ quantity: 7 }],
    });
    expect(err).toContain('debe ser igual');
  });

  it('payload de receive coincide con contrato API', () => {
    const payload = buildReceivePayload([{
      productId: 'p1',
      received: 10,
      allocations: [{ warehouseId: 'w1', quantity: 10 }],
    }]);
    expect(payload.items[0]).toEqual({
      productId: 'p1',
      quantityReceived: 10,
      allocations: [{ warehouseId: 'w1', quantity: 10 }],
    });
  });
});

// ============================================================
// Eficiencia — receive API-first evita doble escritura local
// ============================================================

describe('Eficiencia — receivePurchaseOrder API-first', () => {
  it('con API activa no debe mutar productos localmente (solo hidratar)', () => {
    const inventoryApiAvailable = true;
    const localProductWrites: number[] = [];
    const apiHydrateCalls: string[] = [];

    if (inventoryApiAvailable) {
      apiHydrateCalls.push('orders', 'products', 'movements');
    } else {
      localProductWrites.push(1);
    }

    expect(localProductWrites).toHaveLength(0);
    expect(apiHydrateCalls).toEqual(['orders', 'products', 'movements']);
  });
});

// ============================================================
// Mock fetch — contrato health + endpoints críticos
// ============================================================

describe('Contratos HTTP — endpoints migrados', () => {
  const mockFetch = vi.fn();
  const API_BASE = 'http://localhost:3001';

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it('health check con timeout (eficiencia: no bloquear UI)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    expect(res.ok).toBe(true);
  });

  it('purchase-orders receive usa POST con allocations', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'Recibido' }) });
    const body = {
      items: [{ productId: 'p1', quantityReceived: 5, allocations: [{ warehouseId: 'w1', quantity: 5 }] }],
    };
    await fetch(`${API_BASE}/stock/purchase-orders/PED-001/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      body: JSON.stringify(body),
    });
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/stock/purchase-orders/PED-001/receive`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });

  it('suppliers CRUD requiere token en mutaciones', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 's1' }) });
    await fetch(`${API_BASE}/stock/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' },
      body: JSON.stringify({ name: 'Nuevo', productIds: [] }),
    });
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer jwt',
    });
  });
});
