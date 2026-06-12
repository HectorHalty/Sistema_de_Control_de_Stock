/**
 * API adapter hooks for critical frontend flows.
 * Each hook provides API-first behavior with graceful localStorage fallback.
 *
 * Pattern: API is tried first. If API is unavailable (null or false),
 * the hook returns safe defaults and the component falls back to localStorage.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  salesApi, kitchenApi, mediaApi, sponsorsApi, onlineCatalogApi,
  API_BASE_URL, ApiError,
} from './client';
import type {
  CheckoutPayload, ReturnPayload, KitchenOrderStatus,
  PresignPayload, ConfirmMediaPayload,
} from './client';

/**
 * Check if the API is reachable.
 */
async function isApiReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The admin panel works primarily on localStorage and does not hold an API JWT.
 * When the API rejects a request for auth reasons (401/403), we treat it as
 * "API unavailable" so the caller falls back to the local flow instead of failing.
 */
function isAuthError(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

// ==================== Sales Adapter ====================

export function useSalesApiAdapter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isApiReachable().then(setApiAvailable);
  }, []);

  const checkout = useCallback(async (payload: CheckoutPayload) => {
    if (!apiAvailable) {
      // Signal to caller that API is not available — use localStorage fallback
      return { ok: false, apiUnavailable: true } as const;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await salesApi.checkout(payload, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      if (isAuthError(e)) {
        // La API requiere autenticación que el panel no tiene: usar modo local.
        return { ok: false, apiUnavailable: true } as const;
      }
      const msg = e instanceof ApiError ? e.message : 'Checkout failed';
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const returnSale = useCallback(async (payload: ReturnPayload) => {
    if (!apiAvailable) {
      return { ok: false, apiUnavailable: true } as const;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await salesApi.returnSale(payload, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      if (isAuthError(e)) {
        return { ok: false, apiUnavailable: true } as const;
      }
      const msg = e instanceof ApiError ? e.message : 'Return failed';
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const voidTicket = useCallback(async (ticketId: string, operatorId: string) => {
    if (!apiAvailable) {
      return { ok: false, apiUnavailable: true } as const;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await salesApi.tickets.void(ticketId, operatorId, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      if (isAuthError(e)) {
        return { ok: false, apiUnavailable: true } as const;
      }
      const msg = e instanceof ApiError ? e.message : 'Void failed';
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  return { checkout, returnSale, voidTicket, loading, error, apiAvailable };
}

// ==================== Kitchen Adapter ====================

export function useKitchenApiAdapter(kitchenId?: string) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isApiReachable().then(setApiAvailable);
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!apiAvailable) return;
    setLoading(true);
    try {
      const result = await kitchenApi.orders.list(kitchenId);
      setOrders(result);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [apiAvailable, kitchenId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // SSE connection for real-time updates
  useEffect(() => {
    if (!apiAvailable) return;

    const url = `${API_BASE_URL}/sse/events${kitchenId ? `?kitchenId=${kitchenId}` : ''}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('kitchen-order-updated', () => {
      fetchOrders();
    });

    eventSource.onerror = () => {
      console.warn('SSE connection error, will retry');
    };

    return () => {
      eventSource.close();
    };
  }, [apiAvailable, kitchenId, fetchOrders]);

  // Transition order
  const transitionOrder = useCallback(async (orderId: string, status: KitchenOrderStatus) => {
    if (!apiAvailable) {
      return { ok: false, apiUnavailable: true } as const;
    }
    try {
      const result = await kitchenApi.orders.transition(orderId, status);
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      return { ok: false, apiUnavailable: false, error: e instanceof ApiError ? e.message : 'Transition failed' } as const;
    }
  }, [apiAvailable]);

  return { orders, loading, error, apiAvailable, transitionOrder, refetch: fetchOrders };
}

// ==================== Media Adapter ====================

export function useMediaApiAdapter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isApiReachable().then(setApiAvailable);
  }, []);

  const presignUpload = useCallback(async (payload: PresignPayload) => {
    if (!apiAvailable) return { ok: false, apiUnavailable: true } as const;
    setLoading(true);
    setError(null);
    try {
      const result = await mediaApi.presign(payload, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Presign failed';
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const confirmUpload = useCallback(async (payload: ConfirmMediaPayload & { key: string }) => {
    if (!apiAvailable) return { ok: false, apiUnavailable: true } as const;
    setLoading(true);
    setError(null);
    try {
      const result = await mediaApi.confirm(payload, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Confirm failed';
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const list = useCallback(async (type?: string, matchDate?: string) => {
    if (!apiAvailable) return [];
    try {
      return await mediaApi.list(type, matchDate);
    } catch {
      return [];
    }
  }, [apiAvailable]);

  const remove = useCallback(async (id: string) => {
    if (!apiAvailable) return { ok: false, apiUnavailable: true } as const;
    try {
      await mediaApi.remove(id, '');
      return { ok: true, apiUnavailable: false } as const;
    } catch (e) {
      return { ok: false, apiUnavailable: false, error: e instanceof ApiError ? e.message : 'Delete failed' } as const;
    }
  }, [apiAvailable]);

  return { presignUpload, confirmUpload, list, remove, loading, error, apiAvailable };
}

// ==================== Sponsors Adapter ====================

export function useSponsorsApiAdapter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isApiReachable().then(setApiAvailable);
  }, []);

  const list = useCallback(async (active?: boolean, placement?: string) => {
    if (!apiAvailable) return [];
    try {
      return await sponsorsApi.list(active, placement);
    } catch {
      return [];
    }
  }, [apiAvailable]);

  const create = useCallback(async (data: { name: string; imageUrl: string; placement?: string; linkUrl?: string }) => {
    if (!apiAvailable) return { ok: false, apiUnavailable: true } as const;
    setLoading(true);
    setError(null);
    try {
      const result = await sponsorsApi.create(data, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Create failed';
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const update = useCallback(async (id: string, data: { name?: string; imageUrl?: string; placement?: string; active?: boolean; linkUrl?: string }) => {
    if (!apiAvailable) return { ok: false, apiUnavailable: true } as const;
    setLoading(true);
    setError(null);
    try {
      const result = await sponsorsApi.update(id, data, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Update failed';
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const remove = useCallback(async (id: string) => {
    if (!apiAvailable) return { ok: false, apiUnavailable: true } as const;
    try {
      await sponsorsApi.remove(id, '');
      return { ok: true, apiUnavailable: false } as const;
    } catch (e) {
      return { ok: false, apiUnavailable: false, error: e instanceof ApiError ? e.message : 'Delete failed' } as const;
    }
  }, [apiAvailable]);

  return { list, create, update, remove, loading, error, apiAvailable };
}

// ==================== Online Catalog Adapter ====================

export function useOnlineCatalogApiAdapter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isApiReachable().then(setApiAvailable);
  }, []);

  const list = useCallback(async (active?: boolean, category?: string) => {
    if (!apiAvailable) return [];
    try {
      return await onlineCatalogApi.products.list(active, category);
    } catch {
      return [];
    }
  }, [apiAvailable]);

  const create = useCallback(async (data: { name: string; description?: string; price: number; image?: string; images?: string[]; category: string; attributes?: Record<string, any>; stockProductId?: string }) => {
    if (!apiAvailable) return { ok: false, apiUnavailable: true } as const;
    setLoading(true);
    setError(null);
    try {
      const result = await onlineCatalogApi.products.create(data, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Create failed';
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const update = useCallback(async (id: string, data: { name?: string; description?: string; price?: number; image?: string; images?: string[]; category?: string; attributes?: Record<string, any>; active?: boolean; stockProductId?: string }) => {
    if (!apiAvailable) return { ok: false, apiUnavailable: true } as const;
    setLoading(true);
    setError(null);
    try {
      const result = await onlineCatalogApi.products.update(id, data, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Update failed';
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const remove = useCallback(async (id: string) => {
    if (!apiAvailable) return { ok: false, apiUnavailable: true } as const;
    try {
      await onlineCatalogApi.products.remove(id, '');
      return { ok: true, apiUnavailable: false } as const;
    } catch (e) {
      return { ok: false, apiUnavailable: false, error: e instanceof ApiError ? e.message : 'Delete failed' } as const;
    }
  }, [apiAvailable]);

  return { list, create, update, remove, loading, error, apiAvailable };
}
