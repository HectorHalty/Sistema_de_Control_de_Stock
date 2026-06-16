/**
 * API client configuration.
 * Reads base URL from Vite env var VITE_API_URL, falls back to localhost:3001.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export { API_BASE_URL };

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

/**
 * Low-level fetch wrapper with auth header and JSON serialization.
 */
async function apiFetch<T>(path: string, options?: RequestInit & { token?: string }): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = options?.token || accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, error.message || 'Request failed', error);
  }

  return response.json();
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

/**
 * Auth endpoints
 */
export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ access_token: string; user: { id: string; username: string; role: string } }>(
      '/auth/login',
      { method: 'POST', body: { username, password } },
    ),
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
    adjustStock: (id: string, warehouseId: string, quantity: number, token: string) =>
      apiFetch<StockLevel>(`/stock/products/${id}/stock/adjust`, {
        method: 'POST', token, body: { warehouseId, quantity },
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
  print: (data: PrintTicketPayload) =>
    apiFetch<PrintResult>('/printing/print', { method: 'POST', body: data }),
};

/**
 * Kitchen Display System endpoints
 */
export const kitchenApi = {
  orders: {
    list: (kitchenId?: string, status?: string) => {
      const params = new URLSearchParams();
      if (kitchenId) params.set('kitchenId', kitchenId);
      if (status) params.set('status', status);
      const q = params.toString();
      return apiFetch<KitchenOrder[]>(`/kitchen/orders${q ? `?${q}` : ''}`);
    },
    get: (id: string) => apiFetch<KitchenOrder>(`/kitchen/orders/${id}`),
    activeForKitchen: (kitchenId: string) =>
      apiFetch<KitchenOrder[]>(`/kitchen/kitchens/${kitchenId}/active-orders`),
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
  teams: {
    list: () => apiFetch<FootballTeam[]>('/football/teams'),
    create: (data: { name: string; shortName?: string; logo?: string }, token: string) =>
      apiFetch<FootballTeam>('/football/teams', { method: 'POST', token, body: data }),
  },
  matches: {
    list: (status?: string) => {
      const q = status ? `?status=${status}` : '';
      return apiFetch<FootballMatch[]>(`/football/matches${q}`);
    },
    create: (data: { homeTeamId: string; awayTeamId: string; date: string; venue?: string }, token: string) =>
      apiFetch<FootballMatch>('/football/matches', { method: 'POST', token, body: data }),
    updateScore: (id: string, homeGoals: number, awayGoals: number, token: string) =>
      apiFetch<FootballMatch>(`/football/matches/${id}/score`, {
        method: 'PUT', token, body: { homeGoals, awayGoals },
      }),
  },
  standings: () => apiFetch<StandingRow[]>('/football/standings'),
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

export interface SalesProduct {
  id: string;
  name: string;
  category: string;
  kitchenId: string;
  price: number;
  emoji?: string;
  active: boolean;
  recipe: { id: string; stockProductId: string; quantity: number; stockProduct?: StockProduct }[];
}

export interface SalesTicket {
  id: string;
  number: number;
  createdAt: string;
  status: string;
  total: number;
  operatorId: string;
  note?: string;
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
  createdAt: string;
  updatedAt: string;
  kitchen?: Kitchen;
  items: { id: string; salesProductId: string; name: string; quantity: number; emoji?: string }[];
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
  active: boolean;
  linkUrl?: string;
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
  shortName?: string;
  logo?: string;
}

export interface FootballMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  status: string;
  homeGoals?: number;
  awayGoals?: number;
  venue?: string;
  homeTeam?: FootballTeam;
  awayTeam?: FootballTeam;
}

export interface StandingRow {
  teamId: string;
  teamName?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
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
  emoji?: string; recipe: { stockProductId: string; quantity: number }[];
}

export interface UpdateSalesProductPayload {
  name?: string; category?: string; kitchenId?: string;
  price?: number; emoji?: string; active?: boolean;
  recipe?: { stockProductId: string; quantity: number }[];
}

export interface CheckoutItem {
  salesProductId: string;
  quantity: number;
}

export interface CheckoutPayload {
  items: CheckoutItem[];
  operatorId: string;
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
  operatorId: string;
  idempotencyKey?: string;
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
  kind?: 'venta' | 'devolucion';
  showDate?: boolean;
  showOperator?: boolean;
  showItemDetails?: boolean;
}

export interface PrintResult {
  ok: boolean;
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
  key: string;
  bucket: string;
  method: string;
  headers: Record<string, string>;
}

export interface ConfirmMediaPayload {
  title: string;
  type: 'image' | 'video';
  url: string;
  mimeType: string;
  size: number;
  matchDate?: string;
}

export interface CreateSponsorPayload {
  name: string; imageUrl: string; placement?: string; linkUrl?: string;
}

export interface UpdateSponsorPayload {
  name?: string; imageUrl?: string; placement?: string; active?: boolean; linkUrl?: string;
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
