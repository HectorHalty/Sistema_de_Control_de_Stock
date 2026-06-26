/**
 * API adapter hooks for critical frontend flows.
 * Each hook provides API-first behavior with graceful localStorage fallback.
 *
 * Pattern: API is tried first. If API is unavailable (null or false),
 * the hook returns safe defaults and the component falls back to localStorage.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  salesApi, kitchenApi, mediaApi, sponsorsApi, onlineCatalogApi, printingApi,
  API_BASE_URL, getApiErrorMessage, isApiError,
} from './client';
import type {
  CheckoutPayload, ReturnPayload, ReturnItemsPayload, UpdateTicketItemsPayload,
  KitchenOrderStatus,
  PresignPayload, ConfirmMediaPayload,
  TestPrinterPayload, PrintTicketPayload,
} from './client';
import {
  getCachedPrinterTest,
  setCachedPrinterTest,
} from '@/features/sales/lib/printer-test-cache';
import {
  isNativeLanPrinting,
  nativePingPrinter,
  nativePrintEscPos,
} from '@/features/sales/lib/native-printer';

/**
 * Check if the API is reachable (result cached briefly to avoid duplicate health probes).
 */
let reachabilityCache: { promise: Promise<boolean>; at: number } | null = null;
const REACHABILITY_TTL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 5000;

export async function isApiReachable(): Promise<boolean> {
  const now = Date.now();
  if (reachabilityCache && now - reachabilityCache.at < REACHABILITY_TTL_MS) {
    return reachabilityCache.promise;
  }

  const promise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  })();

  reachabilityCache = { promise, at: now };
  return promise;
}

/** Limpia la caché de reachability (útil tras errores de red). */
export function clearApiReachabilityCache(): void {
  reachabilityCache = null;
}

/**
 * Fase 2 completa: el catálogo (stock + ventas + recetas) vive en la API con UUIDs
 * reales, así que un error del servidor en checkout/void/return es un error real
 * (validación 400, autorización 401/403, stock insuficiente 409, etc.) y NO debe
 * degradar silenciosamente a una venta local —eso crearía un ticket que el servidor
 * nunca registra (stock no descontado server-side, datos divergentes)—.
 *
 * El modo 100% local solo aplica cuando la API está caída (health check en `false`),
 * caso que se maneja antes de llegar acá (apiAvailable). Por eso nunca degradamos
 * ante un `ApiError`: surfaceamos el mensaje al operador para que reintente.
 */
function shouldFallbackToLocal(_e: unknown): boolean {
  return false;
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
    if (apiAvailable === false) {
      return { ok: false, apiUnavailable: true } as const;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await salesApi.checkout(payload, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      if (shouldFallbackToLocal(e)) {
        return { ok: false, apiUnavailable: true } as const;
      }
      const msg = getApiErrorMessage(e, 'No se pudo completar la venta');
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const returnSale = useCallback(async (payload: ReturnPayload) => {
    if (apiAvailable === false) {
      return { ok: false, apiUnavailable: true } as const;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await salesApi.returnSale(payload, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      if (shouldFallbackToLocal(e)) {
        return { ok: false, apiUnavailable: true } as const;
      }
      const msg = getApiErrorMessage(e, 'No se pudo registrar la devolución');
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const returnItems = useCallback(async (payload: ReturnItemsPayload) => {
    if (apiAvailable === false) {
      return { ok: false, apiUnavailable: true } as const;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await salesApi.returnItems(payload, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      if (shouldFallbackToLocal(e)) {
        return { ok: false, apiUnavailable: true } as const;
      }
      const msg = getApiErrorMessage(e, 'No se pudo registrar la devolución');
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const voidTicket = useCallback(async (ticketId: string, operatorId: string) => {
    if (apiAvailable === false) {
      return { ok: false, apiUnavailable: true } as const;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await salesApi.tickets.void(ticketId, operatorId, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      if (shouldFallbackToLocal(e)) {
        return { ok: false, apiUnavailable: true } as const;
      }
      const msg = getApiErrorMessage(e, 'No se pudo anular el ticket');
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  const updateTicketItems = useCallback(async (ticketId: string, payload: UpdateTicketItemsPayload) => {
    if (apiAvailable === false) {
      return { ok: false, apiUnavailable: true } as const;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await salesApi.tickets.updateItems(ticketId, payload, '');
      return { ok: true, apiUnavailable: false, result } as const;
    } catch (e) {
      if (shouldFallbackToLocal(e)) {
        return { ok: false, apiUnavailable: true } as const;
      }
      const msg = getApiErrorMessage(e, 'No se pudo actualizar el ticket');
      setError(msg);
      return { ok: false, apiUnavailable: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, [apiAvailable]);

  return { checkout, returnSale, returnItems, voidTicket, updateTicketItems, loading, error, apiAvailable };
}

// ==================== Printing Adapter ====================

function isPrintingNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (isApiError(e) && (e.status === 0 || e.status >= 502)) return true;
  return false;
}

export function usePrintingApiAdapter() {
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const ok = await isApiReachable();
      if (!cancelled) setApiAvailable(ok);
    };
    void probe();
    const timer = window.setInterval(() => void probe(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const testPrinter = useCallback(async (payload: TestPrinterPayload, force = false) => {
    if (!force) {
      const cached = getCachedPrinterTest(payload);
      if (cached) return cached;
    }

    if (isNativeLanPrinting()) {
      const native = await nativePingPrinter(payload.ip, payload.port);
      const outcome = {
        ok: native.ok,
        apiUnavailable: false,
        error: native.ok ? undefined : native.error,
      } as const;
      setCachedPrinterTest(payload, outcome);
      return outcome;
    }

    try {
      const result = await printingApi.test(payload);
      setApiAvailable(true);
      const outcome = { ok: result.ok, apiUnavailable: false, error: result.error } as const;
      setCachedPrinterTest(payload, outcome);
      return outcome;
    } catch (e) {
      if (isPrintingNetworkError(e)) {
        setApiAvailable(false);
        const outcome = {
          ok: false,
          apiUnavailable: true,
          error: getApiErrorMessage(e, 'No se pudo probar la impresora'),
        } as const;
        setCachedPrinterTest(payload, outcome);
        return outcome;
      }
      const outcome = {
        ok: false,
        apiUnavailable: false,
        error: getApiErrorMessage(e, 'No se pudo probar la impresora'),
      } as const;
      setCachedPrinterTest(payload, outcome);
      return outcome;
    }
  }, []);

  const printTicket = useCallback(async (payload: PrintTicketPayload) => {
    if (isNativeLanPrinting()) {
      const { ip, port, ...renderPayload } = payload;
      try {
        const rendered = await printingApi.render(renderPayload);
        if (!rendered.ok || !rendered.data) {
          return {
            ok: false,
            apiUnavailable: false,
            error: rendered.error || 'No se pudo generar el ticket',
          } as const;
        }
        setApiAvailable(true);
        const native = await nativePrintEscPos(ip, port, rendered.data);
        return {
          ok: native.ok,
          apiUnavailable: false,
          error: native.ok ? undefined : native.error,
        } as const;
      } catch (e) {
        if (isPrintingNetworkError(e)) {
          setApiAvailable(false);
          return { ok: false, apiUnavailable: true, error: getApiErrorMessage(e, 'No se pudo imprimir') } as const;
        }
        return {
          ok: false,
          apiUnavailable: false,
          error: getApiErrorMessage(e, 'No se pudo imprimir'),
        } as const;
      }
    }

    try {
      const result = await printingApi.print(payload);
      setApiAvailable(true);
      return { ok: result.ok, apiUnavailable: false, error: result.error } as const;
    } catch (e) {
      if (isPrintingNetworkError(e)) {
        setApiAvailable(false);
        return { ok: false, apiUnavailable: true, error: getApiErrorMessage(e, 'No se pudo imprimir') } as const;
      }
      return {
        ok: false,
        apiUnavailable: false,
        error: getApiErrorMessage(e, 'No se pudo imprimir'),
      } as const;
    }
  }, []);

  return { testPrinter, printTicket, apiAvailable };
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
      setError(getApiErrorMessage(e, 'No se pudieron cargar los pedidos'));
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
      return { ok: false, apiUnavailable: false, error: getApiErrorMessage(e, 'No se pudo cambiar el estado') } as const;
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
      const msg = getApiErrorMessage(e, 'No se pudo preparar la subida');
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
      const msg = getApiErrorMessage(e, 'No se pudo confirmar la subida');
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
      return { ok: false, apiUnavailable: false, error: getApiErrorMessage(e, 'No se pudo eliminar') } as const;
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
      const msg = getApiErrorMessage(e, 'No se pudo crear');
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
      const msg = getApiErrorMessage(e, 'No se pudo actualizar');
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
      return { ok: false, apiUnavailable: false, error: getApiErrorMessage(e, 'No se pudo eliminar') } as const;
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
      const msg = getApiErrorMessage(e, 'No se pudo crear');
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
      const msg = getApiErrorMessage(e, 'No se pudo actualizar');
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
      return { ok: false, apiUnavailable: false, error: getApiErrorMessage(e, 'No se pudo eliminar') } as const;
    }
  }, [apiAvailable]);

  return { list, create, update, remove, loading, error, apiAvailable };
}
