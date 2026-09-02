/**
 * API client configuration.
 * Resolves public API URL at runtime when the build used localhost by mistake.
 */
import { resolveApiBaseUrl } from './resolve-api-base-url';

/** Resuelve en cada llamada para respetar window.__LCH_API_URL__ (lch-config.js). */
export function getApiBaseUrl(): string {
  return resolveApiBaseUrl();
}

/** @deprecated Prefer getApiBaseUrl() — puede quedar desactualizado si se lee al importar el módulo. */
export const API_BASE_URL = getApiBaseUrl();

export interface ApiOptions {
  token?: string;
}

/**
 * Module-level access token. Set once after login (see setAccessToken) so every
 * request is authenticated without threading the token through each call site.
 * A per-call `token` option still takes precedence when provided.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

type ApiErrorBody = {
  message?: unknown;
  missing?: Array<{ stockProductId: string; required: number; available: number }>;
  statusCode?: number;
};

type NestedNestMessage = {
  message?: unknown;
  missing?: ApiErrorBody['missing'];
};

/** Nest suele anidar `{ message, missing }` dentro de `body.message` en ConflictException. */
function unwrapNestErrorBody(body: ApiErrorBody): ApiErrorBody {
  const raw = body.message;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'message' in raw) {
    const nested = raw as NestedNestMessage;
    return {
      ...body,
      message: nested.message,
      missing: nested.missing ?? body.missing,
    };
  }
  return body;
}

function stockConflictMessage(
  body: ApiErrorBody,
  fallbackLabel: string,
): string | null {
  const msg = body.message;
  const isStockConflict =
    msg === 'Insufficient stock for checkout' ||
    msg === 'Insufficient stock for ticket update';
  if (!isStockConflict) return null;

  if (body.missing?.length) {
    const parts = body.missing.map(
      m => `faltan ${m.required} u., hay ${m.available} en servidor`,
    );
    return `${fallbackLabel} (${parts.join('; ')}). Revisá el inventario.`;
  }
  return `${fallbackLabel} en el servidor. Revisá el inventario.`;
}

/** Mensaje legible para el operador a partir de la respuesta de error de la API. */
export function formatApiErrorMessage(status: number, rawBody: ApiErrorBody): string {
  const body = unwrapNestErrorBody(rawBody);

  if (status === 429) {
    return 'Demasiadas solicitudes. Esperá unos segundos y volvé a intentar.';
  }

  const checkoutStock = stockConflictMessage(body, 'Stock insuficiente');
  if (status === 409 && checkoutStock) return checkoutStock;

  if (status === 404 && typeof body.message === 'string' && body.message.includes('Sales products')) {
    return 'Producto de venta no encontrado en el servidor. Recargá la página o recrealo en Ventas → Productos.';
  }

  if (status === 400 && Array.isArray(body.message)) {
    const msgs = body.message.filter((m): m is string => typeof m === 'string');
    if (msgs.some(m => m.includes('operatorId'))) {
      return 'Sesión inválida. Cerrá sesión y volvé a ingresar.';
    }
    if (msgs.some(m => m.includes('salesProductId'))) {
      return 'Productos de venta no sincronizados con el servidor. Recargá la página o recrealos en Ventas → Productos.';
    }
    return msgs.join(' ');
  }

  if (typeof body.message === 'string') return body.message;
  if (Array.isArray(body.message)) {
    return body.message.filter((m): m is string => typeof m === 'string').join(' ');
  }
  return 'Error en la solicitud';
}

/**
 * Low-level fetch wrapper with auth header and JSON serialization.
 */
async function apiFetch<T>(
  path: string,
  options?: Omit<RequestInit, 'body'> & { token?: string; body?: unknown },
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const { token: tokenOpt, body, ...fetchOpts } = options ?? {};
  const token = tokenOpt || accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOpts.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...fetchOpts,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText })) as ApiErrorBody;
    const message = formatApiErrorMessage(response.status, error);
    // 403 = sin permiso para este recurso; no invalidar sesión (p. ej. hidratación de ventas con Operador_Stock).
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:session-invalid', { detail: { status: response.status } }));
    }
    throw new ApiError(response.status, message, error);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Duck-typing: Vite puede duplicar la clase ApiError entre chunks y romper `instanceof`. */
export function isApiError(e: unknown): e is ApiError {
  return (
    e instanceof ApiError ||
    (typeof e === 'object' &&
      e !== null &&
      (e as ApiError).name === 'ApiError' &&
      typeof (e as ApiError).message === 'string' &&
      typeof (e as ApiError).status === 'number')
  );
}

export function getApiErrorMessage(e: unknown, fallback: string): string {
  if (isApiError(e)) return e.message;
  if (e instanceof TypeError && e.message === 'Failed to fetch') {
    const base = getApiBaseUrl();
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const pageIsLocal = host === 'localhost' || host === '127.0.0.1';
    const apiIsLocal = base.includes('localhost') || base.includes('127.0.0.1');
    if (!pageIsLocal && apiIsLocal) {
      return `No se pudo conectar con la API. El panel intenta usar ${base} pero estás en ${host}. Recargá con ?reset o pedí que recompilen el admin con la URL pública.`;
    }
    return `No se pudo conectar con el servidor (${base}). Verificá internet y que la API esté en línea.`;
  }
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e.trim()) return e;
  return fallback;
}

/**
 * Auth endpoints
 */
export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ access_token: string; user: { id: string; username: string; role: string } }>(
      '/auth/login',
      { method: 'POST', body: { username, password } },
    ),
  me: () =>
    apiFetch<{ user: { id: string; username: string; role: string } }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<void>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
};

export interface ApiUser {
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}

export const usersApi = {
  list: () => apiFetch<ApiUser[]>('/users'),
  create: (data: { username: string; password: string; name: string; role: string }) =>
    apiFetch<ApiUser>('/users', { method: 'POST', body: data }),
  update: (id: string, data: { name: string; role: string }) =>
    apiFetch<ApiUser>(`/users/${id}`, { method: 'PUT', body: data }),
  remove: (id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
};

/**
 * Stock endpoints
 */
export const stockApi = {
  products: {
    list: (categoryId?: string) => {
      const q = categoryId ? `?categoryId=${categoryId}` : '';
      return apiFetch<StockProduct[]>(`/stock/products${q}`);
    },
    get: (id: string) => apiFetch<StockProduct>(`/stock/products/${id}`),
    create: (data: CreateProductPayload, token: string) =>
      apiFetch<StockProduct>('/stock/products', { method: 'POST', token, body: data }),
    update: (id: string, data: UpdateProductPayload, token: string) =>
      apiFetch<StockProduct>(`/stock/products/${id}`, { method: 'PUT', token, body: data }),
    remove: (id: string, token: string) =>
      apiFetch<void>(`/stock/products/${id}`, { method: 'DELETE', token }),
    adjustStock: (
      id: string,
      warehouseId: string,
      quantity: number,
      token: string,
      meta?: { reference?: string; operatorId?: string; operatorName?: string },
    ) =>
      apiFetch<StockLevel>(`/stock/products/${id}/stock/adjust`, {
        method: 'POST',
        token,
        body: { warehouseId, quantity, ...meta },
      }),
  },
  movements: {
    list: (params?: { productId?: string; type?: string; from?: string; to?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.productId) q.set('productId', params.productId);
      if (params?.type) q.set('type', params.type);
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return apiFetch<ApiStockMovement[]>(`/stock/movements${qs ? `?${qs}` : ''}`);
    },
  },
  employeeConsumptions: {
    list: (limit?: number) => {
      const q = limit ? `?limit=${limit}` : '';
      return apiFetch<ApiEmployeeConsumption[]>(`/stock/employee-consumptions${q}`);
    },
    create: (
      data: {
        productId: string;
        warehouseId: string;
        quantity: number;
        note?: string;
        operatorId?: string;
        operatorName?: string;
        operatorRole?: string;
      },
      token: string,
    ) =>
      apiFetch<ApiEmployeeConsumption>('/stock/employee-consumptions', {
        method: 'POST', token, body: data,
      }),
  },
  countSessions: {
    list: (limit?: number) => {
      const q = limit ? `?limit=${limit}` : '';
      return apiFetch<ApiStockCountSession[]>(`/stock/count-sessions${q}`);
    },
    create: (
      data: {
        date: string;
        dateType?: 'regular' | 'after';
        operatorId?: string;
        operatorName?: string;
        entries: {
          productId: string;
          productName: string;
          unit: string;
          expected: number;
          counted: number;
        }[];
      },
      token: string,
    ) =>
      apiFetch<ApiStockCountSession>('/stock/count-sessions', {
        method: 'POST', token, body: data,
      }),
  },
  warehouses: {
    list: () => apiFetch<Warehouse[]>('/stock/warehouses'),
    create: (data: { name: string; location: string; icon?: string }, token: string) =>
      apiFetch<Warehouse>('/stock/warehouses', { method: 'POST', token, body: data }),
    update: (id: string, data: { name?: string; location?: string; icon?: string }, token: string) =>
      apiFetch<Warehouse>(`/stock/warehouses/${id}`, { method: 'PUT', token, body: data }),
    remove: (id: string, token: string) =>
      apiFetch<void>(`/stock/warehouses/${id}`, { method: 'DELETE', token }),
  },
  categories: {
    list: () => apiFetch<Category[]>('/stock/categories'),
    create: (data: { name: string; icon?: string }, token: string) =>
      apiFetch<Category>('/stock/categories', { method: 'POST', token, body: data }),
    update: (id: string, data: { name?: string; icon?: string }, token: string) =>
      apiFetch<Category>(`/stock/categories/${id}`, { method: 'PUT', token, body: data }),
    remove: (id: string, token: string) =>
      apiFetch<void>(`/stock/categories/${id}`, { method: 'DELETE', token }),
  },
  suppliers: {
    list: () => apiFetch<ApiSupplier[]>('/stock/suppliers'),
    create: (data: { name: string; productIds?: string[] }, token: string) =>
      apiFetch<ApiSupplier>('/stock/suppliers', { method: 'POST', token, body: data }),
    update: (id: string, data: { name?: string; productIds?: string[] }, token: string) =>
      apiFetch<ApiSupplier>(`/stock/suppliers/${id}`, { method: 'PUT', token, body: data }),
    remove: (id: string, token: string) =>
      apiFetch<void>(`/stock/suppliers/${id}`, { method: 'DELETE', token }),
  },
  purchaseOrders: {
    list: (status?: string) => {
      const q = status ? `?status=${encodeURIComponent(status)}` : '';
      return apiFetch<ApiPurchaseOrder[]>(`/stock/purchase-orders${q}`);
    },
    get: (id: string) => apiFetch<ApiPurchaseOrder>(`/stock/purchase-orders/${encodeURIComponent(id)}`),
    create: (
      data: {
        supplierId?: string;
        provider: string;
        items: { productId: string; quantityOrdered: number }[];
      },
      token: string,
    ) =>
      apiFetch<ApiPurchaseOrder>('/stock/purchase-orders', { method: 'POST', token, body: data }),
    receive: (
      id: string,
      data: {
        items: {
          productId: string;
          quantityReceived: number;
          allocations: { warehouseId: string; quantity: number }[];
        }[];
        operatorId?: string;
        operatorName?: string;
      },
      token: string,
    ) =>
      apiFetch<ApiPurchaseOrder>(`/stock/purchase-orders/${encodeURIComponent(id)}/receive`, {
        method: 'POST', token, body: data,
      }),
  },
};

/**
 * Sales endpoints
 */
export const salesApi = {
  products: {
    list: () => apiFetch<SalesProduct[]>('/sales/products'),
    get: (id: string) => apiFetch<SalesProduct>(`/sales/products/${id}`),
    create: (data: CreateSalesProductPayload, token: string) =>
      apiFetch<SalesProduct>('/sales/products', { method: 'POST', token, body: data }),
    update: (id: string, data: UpdateSalesProductPayload, token: string) =>
      apiFetch<SalesProduct>(`/sales/products/${id}`, { method: 'PUT', token, body: data }),
  },
  checkout: (data: CheckoutPayload, token: string) =>
    apiFetch<CheckoutResult>('/sales/checkout', { method: 'POST', token, body: data }),
  returnSale: (data: ReturnPayload, token: string) =>
    apiFetch<ReturnResult>('/sales/return', { method: 'POST', token, body: data }),
  returnItems: (data: ReturnItemsPayload, token: string) =>
    apiFetch<ReturnResult>('/sales/return-items', { method: 'POST', token, body: data }),
  tickets: {
    list: (status?: string) => {
      const q = status ? `?status=${status}` : '';
      return apiFetch<SalesTicket[]>(`/sales/tickets${q}`);
    },
    get: (id: string) => apiFetch<SalesTicket>(`/sales/tickets/${id}`),
    void: (id: string, operatorId: string, token: string) =>
      apiFetch<SalesTicket>(`/sales/tickets/${id}/void`, {
        method: 'POST', token, body: { operatorId },
      }),
    updateItems: (id: string, data: UpdateTicketItemsPayload, token: string) =>
      apiFetch<SalesTicket>(`/sales/tickets/${id}/items`, {
        method: 'PUT', token, body: data,
      }),
  },
  kitchens: {
    list: () => apiFetch<Kitchen[]>('/sales/kitchens'),
    create: (data: { name: string; emoji?: string }, token: string) =>
      apiFetch<Kitchen>('/sales/kitchens', { method: 'POST', token, body: data }),
    update: (id: string, data: { name?: string; emoji?: string; active?: boolean }, token: string) =>
      apiFetch<Kitchen>(`/sales/kitchens/${id}`, { method: 'PUT', token, body: data }),
    remove: (id: string, token: string) =>
      apiFetch<void>(`/sales/kitchens/${id}`, { method: 'DELETE', token }),
  },
};

/**
 * Network printing endpoints (raw TCP / ESC-POS handled by the API).
 */
export const printingApi = {
  test: (data: TestPrinterPayload) =>
    apiFetch<PrintResult>('/printing/test', { method: 'POST', body: data }),
  render: (data: RenderTicketPayload) =>
    apiFetch<RenderTicketResult>('/printing/render', { method: 'POST', body: data }),
  print: (data: PrintTicketPayload) =>
    apiFetch<PrintResult>('/printing/print', { method: 'POST', body: data }),
};

/**
 * Kitchen Display System endpoints
 */
export const kitchenApi = {
  orders: {
    list: (kitchenId?: string, status?: string, onlineOnly?: boolean) => {
      const params = new URLSearchParams();
      if (kitchenId) params.set('kitchenId', kitchenId);
      if (status) params.set('status', status);
      if (onlineOnly) params.set('onlineOnly', 'true');
      const q = params.toString();
      return apiFetch<KitchenOrder[]>(`/kitchen/orders${q ? `?${q}` : ''}`);
    },
    get: (id: string) => apiFetch<KitchenOrder>(`/kitchen/orders/${id}`),
    activeForKitchen: (kitchenId: string, onlineOnly?: boolean) => {
      const q = onlineOnly ? '?onlineOnly=true' : '';
      return apiFetch<KitchenOrder[]>(`/kitchen/kitchens/${kitchenId}/active-orders${q}`);
    },
    transition: (id: string, status: KitchenOrderStatus) =>
      apiFetch<KitchenOrder>(`/kitchen/orders/${id}/transition`, {
        method: 'POST', body: { status },
      }),
  },
};

/**
 * Media endpoints
 */
export const mediaApi = {
  presign: (data: PresignPayload, token: string) =>
    apiFetch<PresignResult>('/media/presign', { method: 'POST', token, body: data }),
  confirm: (data: ConfirmMediaPayload, token: string) =>
    apiFetch<MediaItem>('/media/confirm', { method: 'POST', token, body: data }),
  list: (type?: string, matchDate?: string) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (matchDate) params.set('matchDate', matchDate);
    const q = params.toString();
    return apiFetch<MediaItem[]>(`/media${q ? `?${q}` : ''}`);
  },
  get: (id: string) => apiFetch<MediaItem>(`/media/${id}`),
  remove: (id: string, token: string) =>
    apiFetch<void>(`/media/${id}`, { method: 'DELETE', token }),
};

/**
 * Sponsors endpoints
 */
export const sponsorsApi = {
  list: (active?: boolean, placement?: string) => {
    const params = new URLSearchParams();
    if (active !== undefined) params.set('active', String(active));
    if (placement) params.set('placement', placement);
    const q = params.toString();
    return apiFetch<Sponsor[]>(`/sponsors${q ? `?${q}` : ''}`);
  },
  get: (id: string) => apiFetch<Sponsor>(`/sponsors/${id}`),
  create: (data: CreateSponsorPayload, token: string) =>
    apiFetch<Sponsor>('/sponsors', { method: 'POST', token, body: data }),
  update: (id: string, data: UpdateSponsorPayload, token: string) =>
    apiFetch<Sponsor>(`/sponsors/${id}`, { method: 'PUT', token, body: data }),
  remove: (id: string, token: string) =>
    apiFetch<void>(`/sponsors/${id}`, { method: 'DELETE', token }),
};

/**
 * Football endpoints
 */
export const footballApi = {
  overview: (token: string, torneoId?: string) => {
    const q = torneoId ? `?torneoId=${torneoId}` : '';
    return apiFetch<FootballOverview>(`/football/overview${q}`, { token });
  },
  torneos: (token: string) => apiFetch<FootballTorneo[]>('/football/torneos', { token }),
  createTorneo: (
    data: { campeonatoId: string; categoriaId: string; nombre?: string },
    token: string,
  ) => apiFetch<FootballTorneo>('/football/torneos', { method: 'POST', token, body: data }),
  bootstrapTorneos: (token: string, campeonatoId?: string) =>
    apiFetch<{ campeonatoId: string; created: number; categorias: string[] }>(
      '/football/torneos/bootstrap',
      { method: 'POST', token, body: { campeonatoId } },
    ),
  updateTorneo: (
    id: string,
    data: { publicado?: boolean; activo?: boolean; nombre?: string },
    token: string,
  ) => apiFetch<FootballTorneo>(`/football/torneos/${id}`, { method: 'PUT', token, body: data }),
  canchas: (token: string) => apiFetch<FootballCancha[]>('/football/canchas', { token }),
  teams: {
    list: (token: string) => apiFetch<FootballTeam[]>('/football/teams', { token }),
    create: (data: { name: string; shortName?: string; logo?: string; color?: string }, token: string) =>
      apiFetch<FootballTeam>('/football/teams', { method: 'POST', token, body: data }),
  },
  inscriptions: {
    list: (token: string, torneoId?: string) => {
      const q = torneoId ? `?torneoId=${torneoId}` : '';
      return apiFetch<FootballInscription[]>(`/football/inscriptions${q}`, { token });
    },
    create: (
      data: {
        torneoId: string;
        equipoId?: string;
        name?: string;
        shortName?: string;
        color?: string;
        abbr?: string;
      },
      token: string,
    ) => apiFetch<FootballInscription>('/football/inscriptions', { method: 'POST', token, body: data }),
    update: (
      id: string,
      data: { abbr?: string; color?: string; activo?: boolean; descuentoPuntosWO?: number },
      token: string,
    ) => apiFetch<FootballInscription>(`/football/inscriptions/${id}`, { method: 'PUT', token, body: data }),
  },
  captains: {
    list: (token: string, torneoId?: string) => {
      const q = torneoId ? `?torneoId=${torneoId}` : '';
      return apiFetch<FootballCaptain[]>(`/football/captains${q}`, { token });
    },
    create: (
      data: { email: string; dni: string; torneoId: string; equipoInscripcionId: string },
      token: string,
    ) => apiFetch<FootballCaptain>('/football/captains', { method: 'POST', token, body: data }),
    update: (id: string, data: { email?: string; dni?: string; activo?: boolean }, token: string) =>
      apiFetch<FootballCaptain>(`/football/captains/${id}`, { method: 'PUT', token, body: data }),
    remove: (id: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/football/captains/${id}`, { method: 'DELETE', token }),
  },
  roster: {
    get: (inscripcionId: string, token: string) =>
      apiFetch<FootballRoster>(`/football/roster/${inscripcionId}`, { token }),
    listaBuenaFeUrl: (inscripcionId: string) =>
      `${resolveApiBaseUrl()}/football/roster/${inscripcionId}/lista-buena-fe`,
  },
  jornadas: {
    list: (token: string, torneoId?: string) => {
      const q = torneoId ? `?torneoId=${torneoId}` : '';
      return apiFetch<FootballJornada[]>(`/football/jornadas${q}`, { token });
    },
    create: (data: { torneoId: string; numero: number; fecha: string }, token: string) =>
      apiFetch<FootballJornada>('/football/jornadas', { method: 'POST', token, body: data }),
    roundRobin: (jornadaId: string, token: string) =>
      apiFetch<{ created: number; matches: FootballMatch[] }>(
        `/football/jornadas/${jornadaId}/round-robin`,
        { method: 'POST', token },
      ),
    autoSchedule: (jornadaId: string, token: string) =>
      apiFetch<{ scheduled: number; warnings: string[]; skippedManual: number }>(
        `/football/jornadas/${jornadaId}/auto-schedule`,
        { method: 'POST', token },
      ),
    suspendRain: (jornadaId: string, token: string) =>
      apiFetch<{
        recoveryJornadaId: string;
        recoveryNumero: number;
        movedMatches: number;
      }>(`/football/jornadas/${jornadaId}/suspend-rain`, { method: 'POST', token }),
    publish: (jornadaId: string, token: string) =>
      apiFetch<{ jornadaId: string; publicada: boolean }>(
        `/football/jornadas/${jornadaId}/publish`,
        { method: 'POST', token },
      ),
    preferencias: {
      get: (jornadaId: string, token: string) =>
        apiFetch<FootballJornadaPreferencias>(`/football/jornadas/${jornadaId}/preferencias`, {
          token,
        }),
      upsert: (
        jornadaId: string,
        inscripcionId: string,
        horaPreferida: string | null,
        token: string,
      ) =>
        apiFetch<{ equipoInscripcionId: string; horaPreferida: string | null }>(
          `/football/jornadas/${jornadaId}/preferencias/${inscripcionId}`,
          { method: 'PUT', token, body: { horaPreferida } },
        ),
    },
  },
  matches: {
    list: (token: string, filters?: { status?: string; torneoId?: string; jornadaId?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.torneoId) params.set('torneoId', filters.torneoId);
      if (filters?.jornadaId) params.set('jornadaId', filters.jornadaId);
      const q = params.toString();
      return apiFetch<FootballMatch[]>(`/football/matches${q ? `?${q}` : ''}`, { token });
    },
    create: (
      data: {
        homeTeamId: string;
        awayTeamId: string;
        date: string;
        venue?: string;
        torneoId?: string;
        jornadaId?: string;
        homeInscripcionId?: string;
        awayInscripcionId?: string;
        canchaId?: string;
        horaInicio?: string;
      },
      token: string,
    ) => apiFetch<FootballMatch>('/football/matches', { method: 'POST', token, body: data }),
    updateSchedule: (
      id: string,
      data: {
        canchaId?: string | null;
        horaInicio?: string | null;
        jornadaId?: string | null;
        bloqueadoManual?: boolean;
        venue?: string | null;
      },
      token: string,
    ) =>
      apiFetch<{ match: FootballMatch; warnings: string[] }>(
        `/football/matches/${id}/schedule`,
        { method: 'PUT', token, body: data },
      ),
    updateScore: (
      id: string,
      homeGoals: number,
      awayGoals: number,
      token: string,
      events?: { personaId: string; tipo: string; minuto?: number }[],
    ) =>
      apiFetch<FootballMatch>(`/football/matches/${id}/score`, {
        method: 'PUT',
        token,
        body: { homeGoals, awayGoals, events },
      }),
    listEvents: (matchId: string, token: string) =>
      apiFetch<FootballMatchEvent[]>(`/football/matches/${matchId}/events`, { token }),
    addEvent: (
      matchId: string,
      data: { personaId: string; tipo: string; minuto?: number; articuloRef?: string },
      token: string,
    ) =>
      apiFetch<FootballMatchEvent>(`/football/matches/${matchId}/events`, {
        method: 'POST',
        token,
        body: data,
      }),
    deleteEvent: (eventId: string, token: string) =>
      apiFetch<void>(`/football/events/${eventId}`, { method: 'DELETE', token }),
  },
  standings: (token: string, torneoId?: string) => {
    const q = torneoId ? `?torneoId=${torneoId}` : '';
    return apiFetch<StandingRow[]>(`/football/standings${q}`, { token });
  },
  scheduling: {
    saturdayGrid: (token: string, fecha: string, campeonatoId?: string) => {
      const params = new URLSearchParams({ fecha });
      if (campeonatoId) params.set('campeonatoId', campeonatoId);
      return apiFetch<SaturdayGridResponse>(`/football/scheduling/saturday?${params}`, { token });
    },
    autoSaturday: (
      token: string,
      data: { fecha: string; campeonatoId?: string; categoriaOrder?: string[] },
    ) =>
      apiFetch<{
        fecha: string;
        scheduled: number;
        skippedManual: number;
        unassigned: number;
        warnings: string[];
      }>('/football/scheduling/auto-saturday', { method: 'POST', token, body: data }),
    publishFecha: (token: string, data: { fecha: string; campeonatoId?: string }) =>
      apiFetch<{ fecha: string; publicadas: number }>(
        '/football/scheduling/publish-fecha',
        { method: 'POST', token, body: data },
      ),
  },
  suspensions: {
    list: (token: string, torneoId?: string) => {
      const q = torneoId ? `?torneoId=${torneoId}` : '';
      return apiFetch<FootballSuspension[]>(`/football/suspensions${q}`, { token });
    },
    update: (
      id: string,
      data: { fechasRestantes?: number; activa?: boolean; motivo?: string },
      token: string,
    ) => apiFetch<FootballSuspension>(`/football/suspensions/${id}`, { method: 'PUT', token, body: data }),
    sync: (token: string, torneoId?: string) => {
      const q = torneoId ? `?torneoId=${torneoId}` : '';
      return apiFetch<{ updated: number }>(`/football/suspensions/sync${q}`, { method: 'POST', token });
    },
  },
  reglamento: {
    list: (token: string) => apiFetch<FootballReglamento>('/football/reglamento', { token }),
    updateArticulo: (
      id: string,
      data: { titulo?: string; contenido?: string; aplicable?: boolean },
      token: string,
    ) =>
      apiFetch<FootballReglamentoArticulo>(`/football/reglamento/articulos/${id}`, {
        method: 'PUT',
        token,
        body: data,
      }),
  },
};

/**
 * Online module endpoints (cantina web)
 */
export const onlineApi = {
  overview: (token: string) => apiFetch<OnlineOverview>('/online/overview', { token }),
  metrics: (token: string, from?: string, to?: string, range?: '7d' | '30d' | '90d' | 'Año') => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (range) params.set('range', range);
    const q = params.toString();
    return apiFetch<OnlineMetrics>(`/online/metrics${q ? `?${q}` : ''}`, { token });
  },
  orders: {
    list: (token: string, status?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (limit) params.set('limit', String(limit));
      const q = params.toString();
      return apiFetch<OnlinePublicOrder[]>(`/online/orders${q ? `?${q}` : ''}`, { token });
    },
  },
  menu: {
    list: (token: string, visibleOnly?: boolean) => {
      const q = visibleOnly ? '?visibleOnly=true' : '';
      return apiFetch<WebMenuProduct[]>(`/online/menu${q}`, { token });
    },
    create: (
      data: CreateWebMenuProductPayload,
      token: string,
    ) => apiFetch<WebMenuProduct>('/online/menu', { method: 'POST', token, body: data }),
    update: (
      id: string,
      data: UpdateWebMenuProductPayload,
      token: string,
    ) => apiFetch<WebMenuProduct>(`/online/menu/${id}`, { method: 'PUT', token, body: data }),
  },
  categories: {
    list: (token: string) => apiFetch<WebCategory[]>(`/online/categories`, { token }),
    create: (data: { name: string; sortOrder?: number }, token: string) =>
      apiFetch<WebCategory>('/online/categories', { method: 'POST', token, body: data }),
    update: (id: string, data: { name?: string; sortOrder?: number; active?: boolean }, token: string) =>
      apiFetch<WebCategory>(`/online/categories/${id}`, { method: 'PUT', token, body: data }),
    remove: (id: string, token: string) =>
      apiFetch<void>(`/online/categories/${id}`, { method: 'DELETE', token }),
  },
  filters: {
    list: (token: string) => apiFetch<WebFilter[]>(`/online/filters`, { token }),
    create: (data: { label: string; slug?: string; sortOrder?: number }, token: string) =>
      apiFetch<WebFilter>('/online/filters', { method: 'POST', token, body: data }),
    update: (id: string, data: { label?: string; slug?: string; sortOrder?: number; active?: boolean }, token: string) =>
      apiFetch<WebFilter>(`/online/filters/${id}`, { method: 'PUT', token, body: data }),
    remove: (id: string, token: string) =>
      apiFetch<void>(`/online/filters/${id}`, { method: 'DELETE', token }),
  },
  kitchens: {
    list: (token: string) =>
      apiFetch<{ id: string; name: string; emoji?: string | null }[]>('/online/kitchens', { token }),
  },
  redeemQr: (token: string, authToken: string) =>
    apiFetch<RedeemQrResponse>('/online/redeem-qr', { method: 'POST', token: authToken, body: { token } }),
};

/**
 * Online Catalog endpoints
 */
export const onlineCatalogApi = {
  products: {
    list: (active?: boolean, category?: string) => {
      const params = new URLSearchParams();
      if (active !== undefined) params.set('active', String(active));
      if (category) params.set('category', category);
      const q = params.toString();
      return apiFetch<OnlineProduct[]>(`/online-catalog/products${q ? `?${q}` : ''}`);
    },
    get: (id: string) => apiFetch<OnlineProduct>(`/online-catalog/products/${id}`),
    create: (data: CreateOnlineProductPayload, token: string) =>
      apiFetch<OnlineProduct>('/online-catalog/products', { method: 'POST', token, body: data }),
    update: (id: string, data: UpdateOnlineProductPayload, token: string) =>
      apiFetch<OnlineProduct>(`/online-catalog/products/${id}`, { method: 'PUT', token, body: data }),
    remove: (id: string, token: string) =>
      apiFetch<void>(`/online-catalog/products/${id}`, { method: 'DELETE', token }),
  },
};

// ============ Type definitions shared between API and frontend ============

export interface StockProduct {
  id: string;
  name: string;
  code: string;
  description?: string;
  categoryId: string;
  unit: string;
  orderUnit?: number;
  image?: string;
  stockLevels: StockLevel[];
  category?: Category;
}

export interface StockLevel {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  warehouse?: Warehouse;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  icon?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface ApiStockMovement {
  id: string;
  createdAt: string;
  type: string;
  productId: string;
  warehouseId?: string | null;
  quantity: number | string;
  reference?: string | null;
  operatorId?: string | null;
  operatorName?: string | null;
}

export interface ApiEmployeeConsumption {
  id: string;
  day: string;
  createdAt: string;
  productId: string;
  productName: string;
  productCode?: string | null;
  warehouseId: string;
  warehouseName: string;
  quantity: number | string;
  unit: string;
  previousStock: number | string;
  newStock: number | string;
  operatorId?: string | null;
  operatorName?: string | null;
  operatorRole?: string | null;
  note?: string | null;
}

export interface ApiStockCountEntry {
  id: string;
  sessionId: string;
  productId: string;
  productName: string;
  unit: string;
  expected: number | string;
  counted: number | string;
}

export interface ApiStockCountSession {
  id: string;
  createdAt: string;
  date: string;
  dateType: string;
  operatorId?: string | null;
  operatorName?: string | null;
  entries: ApiStockCountEntry[];
}

export interface ApiSupplier {
  id: string;
  name: string;
  products: { id: string; supplierId: string; productId: string }[];
}

export interface ApiPurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantityOrdered: number | string;
  quantityReceived?: number | string | null;
}

export interface ApiPurchaseOrder {
  id: string;
  orderNumber: string;
  date: string;
  provider: string;
  supplierId?: string | null;
  status: string;
  receivedAt?: string | null;
  createdAt: string;
  items: ApiPurchaseOrderItem[];
}

export interface SalesProduct {
  id: string;
  name: string;
  category: string;
  kitchenId: string;
  price: number;
  emoji?: string;
  kind?: string;
  active: boolean;
  recipe: { id: string; stockProductId: string; quantity: number; stockProduct?: StockProduct }[];
  bundleItems?: Array<{
    id: string;
    componentProductId: string;
    quantity: number;
    componentProduct?: { id: string; name: string; emoji?: string };
  }>;
}

export interface SalesTicket {
  id: string;
  number: number;
  createdAt: string;
  status: string;
  total: number;
  operatorId: string;
  note?: string;
  operator?: { username: string };
  items: { id: string; salesProductId: string; name: string; unitPrice: number; quantity: number }[];
  kitchenOrders?: KitchenOrder[];
}

export interface Kitchen {
  id: string;
  name: string;
  emoji?: string;
  active: boolean;
}

export interface KitchenOrder {
  id: string;
  ticketId: string;
  ticketNumber: number;
  kitchenId: string;
  status: KitchenOrderStatus;
  operatorName: string;
  tableId?: string;
  tableName?: string;
  pedidoPublicoId?: string | null;
  createdAt: string;
  updatedAt: string;
  kitchen?: Kitchen;
  items: { id: string; salesProductId: string; name: string; quantity: number; emoji?: string }[];
  pedidoPublico?: {
    id: string;
    status: string;
    tokenRetiro?: { token: string; usadoEn?: string | null } | null;
  } | null;
  ticket?: { number: number; status: string; origen?: string; total?: number; createdAt?: string };
}

export interface OnlineOverview {
  pedidosTotal: number;
  recaudacionTotal: number;
  pedidosHoy: number;
  recaudacionHoy: number;
  cocinaActivos: number;
  menuVisible: number;
  topItems: { name: string; quantity: number }[];
}

export interface OnlineMetrics {
  totalPedidos: number;
  recaudacion: number;
  recaudacionHoy: number;
  ticketPromedio: number;
  ticketsHoy: number;
  porEstado: { status: string; count: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  salesByDay: { id: string; day: string; ventas: number; tickets: number }[];
  topProductsByKitchen: {
    kitchen: string;
    id: string;
    color: string;
    products: { id: string; name: string; value: number; revenue: number }[];
    totalUnits: number;
    totalRevenue: number;
  }[];
  range?: string;
}

export interface RedeemQrResponse {
  ok: boolean;
  pedido: {
    id: string;
    status: string;
    total: number;
    ticketNumber: number | null;
    customerName: string;
    pickupKitchen: string | null;
    kitchens: { id: string; name: string; emoji?: string | null }[];
    items: { name: string; quantity: number; unitPrice: number; emoji?: string | null }[];
    retiradoEn: string;
  };
}

export interface OnlinePublicOrder {
  id: string;
  status: string;
  total: number | string;
  createdAt: string;
  nota?: string | null;
  items: { id: string; name: string; quantity: number; unitPrice: number | string }[];
  tokenRetiro?: { token: string; usadoEn?: string | null } | null;
  ticketVenta?: { number: number } | null;
  cuentaPublica?: { email: string };
}

export interface WebMenuProduct {
  id: string;
  name: string;
  category: string;
  kitchenId: string;
  price: number | string;
  emoji?: string | null;
  active: boolean;
  visibleWeb: boolean;
  descripcionWeb?: string | null;
  imagenWeb?: string | null;
  webCategoryId?: string | null;
  popularWeb?: boolean;
  webSortOrder?: number;
  kitchen?: { id: string; name: string; emoji?: string | null };
  webCategory?: { id: string; name: string; slug: string } | null;
  filtrosWeb?: { filtro: { id: string; slug: string; label: string } }[];
}

export interface WebCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  _count?: { productos: number };
}

export interface WebFilter {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
  active: boolean;
  _count?: { productos: number };
}

export interface CreateWebMenuProductPayload {
  name: string;
  category: string;
  kitchenId: string;
  price: number;
  emoji?: string;
  descripcionWeb?: string;
  imagenWeb?: string;
  visibleWeb?: boolean;
  webCategoryId?: string;
  popularWeb?: boolean;
  filterIds?: string[];
}

export interface UpdateWebMenuProductPayload {
  name?: string;
  category?: string;
  kitchenId?: string;
  visibleWeb?: boolean;
  descripcionWeb?: string | null;
  imagenWeb?: string | null;
  emoji?: string | null;
  price?: number;
  webCategoryId?: string | null;
  popularWeb?: boolean;
  webSortOrder?: number;
  filterIds?: string[];
  active?: boolean;
}

export type KitchenOrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered';

export interface MediaItem {
  id: string;
  title: string;
  type: string;
  url: string;
  mimeType: string;
  size: number;
  key: string;
  matchDate?: string;
  createdAt: string;
}

export interface Sponsor {
  id: string;
  name: string;
  imageUrl: string;
  placement: string;
  bannerLabel?: string | null;
  mediaType?: string;
  widthPx?: number | null;
  heightPx?: number | null;
  sortOrder?: number;
  active: boolean;
  linkUrl?: string | null;
}

export interface OnlineProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  images: string[];
  category: string;
  attributes?: Record<string, any>;
  active: boolean;
  stockProductId?: string;
}

export interface FootballTeam {
  id: string;
  name: string;
  shortName?: string | null;
  logo?: string | null;
  color?: string | null;
}

export interface FootballTorneo {
  id: string;
  nombre: string;
  activo: boolean;
  publicado: boolean;
  categoria?: { id: string; nombre: string; codigo: string };
  campeonato?: { id: string; nombre: string };
}

export interface FootballInscription {
  id: string;
  torneoId: string;
  equipoId: string;
  abbr?: string | null;
  color?: string | null;
  activo: boolean;
  equipo: FootballTeam;
  torneo?: FootballTorneo & { categoria?: { nombre: string } };
  _count?: { jugadores: number };
}

export interface FootballCaptain {
  id: string;
  email: string;
  dni: string;
  activo: boolean;
  equipoInscripcionId: string;
  torneoId: string;
  equipoInscripcion?: { equipo: FootballTeam };
  torneo?: FootballTorneo;
}

export interface FootballRosterPlayer {
  id: string;
  personaId: string;
  nombre: string;
  apellido: string;
  dni: string;
  email?: string | null;
  fechaNacimiento?: string | null;
  numeroCamiseta?: number | null;
  rolPlantel: string;
}

export interface FootballRoster {
  inscripcion: FootballInscription;
  jugadores: FootballRosterPlayer[];
}

export interface FootballJornada {
  id: string;
  torneoId: string;
  numero: number;
  fecha: string;
  suspendida: boolean;
  esRecuperacion: boolean;
  publicada: boolean;
  _count?: { partidos: number };
}

export interface FootballJornadaPreferencias {
  jornadaId: string;
  franjas: string[];
  equipos: { inscripcionId: string; name: string; horaPreferida: string | null }[];
}

export interface FootballCancha {
  id: string;
  numero: number;
  nombre?: string | null;
  grupoCanchas?: { codigo: string; nombre: string };
}

export interface FootballMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeInscripcionId?: string | null;
  awayInscripcionId?: string | null;
  date: string;
  status: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
  venue?: string | null;
  horaInicio?: string | null;
  canchaId?: string | null;
  jornadaId?: string | null;
  bloqueadoManual?: boolean;
  homeTeam?: FootballTeam;
  awayTeam?: FootballTeam;
  cancha?: FootballCancha | null;
  jornada?: FootballJornada | null;
  eventos?: FootballMatchEvent[];
}

export interface FootballMatchEvent {
  id: string;
  partidoId: string;
  personaId: string;
  tipo: string;
  minuto?: number | null;
  articuloRef?: string | null;
  persona?: {
    id: string;
    nombre: string;
    apellido: string;
    dni: string;
  };
}

export interface FootballSuspension {
  id: string;
  personaId: string;
  torneoId?: string | null;
  motivo: string;
  fechasRestantes: number;
  activa: boolean;
  persona?: { nombre: string; apellido: string; dni: string };
}

export interface FootballReglamentoArticulo {
  id: string;
  numero: string;
  titulo?: string | null;
  contenido: string;
  aplicable: boolean;
  orden: number;
}

export interface FootballReglamentoApartado {
  id: string;
  numero: number;
  titulo: string;
  articulos: FootballReglamentoArticulo[];
}

export interface FootballReglamento {
  apartados: FootballReglamentoApartado[];
  anexos: { id: string; titulo: string; contenido: string }[];
}

export interface FootballOverview {
  torneo: FootballTorneo | null;
  stats: { equipos: number; partidos: number; capitanes: number; jornadas: number } | null;
  torneos?: FootballTorneo[];
}

export interface SaturdayGridResponse {
  fecha: string;
  campeonato: string;
  canchas: FootballCancha[];
  partidos: {
    id: string;
    hora: string | null;
    canchaId: string | null;
    canchaNumero?: number;
    categoria: string;
    categoriaColor?: string | null;
    local: string;
    visitante: string;
    bloqueadoManual: boolean;
    jornada: number | null;
  }[];
}

export interface StandingRow {
  inscripcionId?: string;
  teamId: string;
  teamName?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff?: number;
  points: number;
  descuentoPuntosWO?: number;
}

// ============ Payload types ============

export interface CreateProductPayload {
  name: string; code: string; description?: string;
  categoryId: string; unit?: string; orderUnit?: number;
  image?: string; initialStock?: number; warehouseId?: string;
}

export interface UpdateProductPayload {
  name?: string; code?: string; description?: string;
  categoryId?: string; unit?: string; orderUnit?: number; image?: string;
}

export interface CreateSalesProductPayload {
  name: string; category: string; kitchenId: string; price: number;
  emoji?: string; kind?: string;
  recipe?: { stockProductId: string; quantity: number }[];
  bundle?: { componentProductId: string; quantity: number }[];
}

export interface UpdateSalesProductPayload {
  name?: string; category?: string; kitchenId?: string;
  price?: number; emoji?: string; active?: boolean; kind?: string;
  recipe?: { stockProductId: string; quantity: number }[];
  bundle?: { componentProductId: string; quantity: number }[];
}

export interface CheckoutItem {
  salesProductId: string;
  quantity: number;
}

export interface CheckoutPayload {
  items: CheckoutItem[];
  operatorId?: string;
  note?: string;
  idempotencyKey?: string;
}

export interface CheckoutResult {
  ok: boolean;
  ticket: SalesTicket;
  idempotent: boolean;
}

export interface ReturnPayload {
  ticketId: string;
  operatorId?: string;
  idempotencyKey?: string;
}

export interface ReturnItemsPayload {
  items: CheckoutItem[];
  operatorId?: string;
  note?: string;
  idempotencyKey?: string;
}

export interface UpdateTicketItemsPayload {
  items: CheckoutItem[];
  operatorId?: string;
}

export interface ReturnResult {
  ok: boolean;
  ticket: SalesTicket;
  idempotent: boolean;
}

export interface TestPrinterPayload {
  ip: string;
  port: number;
}

export interface PrintTicketItem {
  name: string;
  quantity: number;
  unitPrice: number;
  station?: string;
}

export interface PrintTicketPayload {
  ip: string;
  port: number;
  paperWidth: 58 | 80;
  ticketNumber: number;
  createdAt: string;
  items: PrintTicketItem[];
  total: number;
  header?: string;
  subheader?: string;
  footer?: string;
  operatorName?: string;
  note?: string;
  source?: string;
  context?: string;
  pickupStation?: string;
  kind?: 'venta' | 'devolucion';
  showDate?: boolean;
  showOperator?: boolean;
  showItemDetails?: boolean;
  showLogo?: boolean;
}

export interface PrintResult {
  ok: boolean;
  error?: string;
}

export type RenderTicketPayload = Omit<PrintTicketPayload, 'ip' | 'port'>;

export interface RenderTicketResult {
  ok: boolean;
  data?: string;
  error?: string;
}

export interface PresignPayload {
  type: 'image' | 'video';
  fileName: string;
  mimeType: string;
  size: number;
  matchDate?: string;
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl?: string;
  key: string;
  bucket: string;
  method: string;
  headers: Record<string, string>;
}

export interface ConfirmMediaPayload {
  key: string;
  title: string;
  type: 'image' | 'video';
  url: string;
  mimeType: string;
  size: number;
  matchDate?: string;
}

export interface CreateSponsorPayload {
  name: string;
  imageUrl: string;
  placement?: string;
  linkUrl?: string;
  bannerLabel?: string;
  mediaType?: string;
  widthPx?: number;
  heightPx?: number;
  sortOrder?: number;
}

export interface UpdateSponsorPayload {
  name?: string;
  imageUrl?: string;
  placement?: string;
  active?: boolean;
  linkUrl?: string;
  bannerLabel?: string;
  mediaType?: string;
  widthPx?: number;
  heightPx?: number;
  sortOrder?: number;
}

export interface CreateOnlineProductPayload {
  name: string; description?: string; price: number; image?: string;
  images?: string[]; category: string; attributes?: Record<string, any>;
  stockProductId?: string;
}

export interface UpdateOnlineProductPayload {
  name?: string; description?: string; price?: number; image?: string;
  images?: string[]; category?: string; attributes?: Record<string, any>;
  active?: boolean; stockProductId?: string;
}
