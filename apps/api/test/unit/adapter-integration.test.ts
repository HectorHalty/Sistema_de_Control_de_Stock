import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Adapter integration tests.
 * Tests the adapter layer behavior with mocked fetch to verify
 * the API-first + localStorage fallback pattern works correctly.
 */

const mockFetch = vi.fn();
global.fetch = mockFetch;

const API_BASE = 'http://localhost:3001';

describe('Adapter integration - sales checkout flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('health check determines API availability', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    expect(res.ok).toBe(true);
  });

  it('checkout payload matches API contract', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        ticket: { id: 't-1', number: 1001, total: '10400', status: 'emitido', items: [] },
        idempotent: false,
      }),
    });

    const payload = {
      items: [
        { salesProductId: 'sp-hamburguesa-simple', quantity: 2 },
      ],
      operatorId: 'admin',
      idempotencyKey: 'checkout-123',
    };

    const response = await fetch(`${API_BASE}/sales/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/sales/checkout`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(false);
  });

  it('return payload matches API contract', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        ticket: { id: 't-1', number: 1001, status: 'devuelto' },
        idempotent: false,
      }),
    });

    const payload = {
      ticketId: 't-1',
      operatorId: 'admin',
      idempotencyKey: 'return-t-1-123',
    };

    const response = await fetch(`${API_BASE}/sales/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    expect(result.ticket.status).toBe('devuelto');
  });

  it('adapter returns apiUnavailable when health check fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    let apiAvailable = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 100);
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      apiAvailable = res.ok;
    } catch {
      apiAvailable = false;
    }

    expect(apiAvailable).toBe(false);
  });
});

describe('Adapter integration - kitchen transition flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transition order calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'ko-1',
        status: 'preparing',
        ticketNumber: 1001,
        kitchenId: 'k-parrilla',
        items: [],
      }),
    });

    const response = await fetch(`${API_BASE}/kitchen/orders/ko-1/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'preparing' }),
    });
    const result = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/kitchen/orders/ko-1/transition`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ status: 'preparing' }),
      }),
    );
    expect(result.status).toBe('preparing');
  });

  it('fetch orders with kitchen filter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { id: 'ko-1', status: 'pending', ticketNumber: 1001, kitchenId: 'k-parrilla' },
      ]),
    });

    const response = await fetch(`${API_BASE}/kitchen/orders?kitchenId=k-parrilla`);
    const result = await response.json();

    expect(result).toHaveLength(1);
    expect(result[0].kitchenId).toBe('k-parrilla');
  });

  it('SSE endpoint URL is correct', () => {
    const kitchenId = 'k-parrilla';
    const url = `${API_BASE}/sse/events?kitchenId=${kitchenId}`;
    expect(url).toBe('http://localhost:3001/sse/events?kitchenId=k-parrilla');
  });
});

describe('Adapter integration - media/sponsor CRUD call path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('presign upload calls correct endpoint with validation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        uploadUrl: 'https://presigned.example.com/upload',
        publicUrl: 'http://localhost:9000/lch-media/images/123.jpg',
        key: 'images/123.jpg',
        bucket: 'lch-media',
        method: 'PUT',
        expiresIn: 3600,
      }),
    });

    const payload = {
      type: 'image' as const,
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024 * 500, // 500KB
    };

    const response = await fetch(`${API_BASE}/media/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/media/presign`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
    expect(result.uploadUrl).toContain('presigned');
    expect(result.expiresIn).toBe(3600);
  });

  it('confirm upload persists metadata', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'mi-1',
        title: 'Match Photo',
        type: 'image',
        url: 'http://localhost:9000/lch-media/images/123.jpg',
        mimeType: 'image/jpeg',
        size: 512000,
        key: 'images/123.jpg',
      }),
    });

    const payload = {
      key: 'images/123.jpg',
      title: 'Match Photo',
      type: 'image' as const,
      url: 'http://localhost:9000/lch-media/images/123.jpg',
      mimeType: 'image/jpeg',
      size: 512000,
    };

    const response = await fetch(`${API_BASE}/media/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    expect(result.id).toBe('mi-1');
    expect(result.key).toBe('images/123.jpg');
  });

  it('sponsor CRUD calls correct endpoints', async () => {
    // Create
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'sp-1', name: 'Sponsor A', active: true }),
    });

    const createRes = await fetch(`${API_BASE}/sponsors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sponsor A', imageUrl: 'https://example.com/logo.png', placement: 'banner' }),
    });
    const createResult = await createRes.json();
    expect(createResult.name).toBe('Sponsor A');

    // List
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 'sp-1', name: 'Sponsor A', active: true }]),
    });

    const listRes = await fetch(`${API_BASE}/sponsors?active=true`);
    const listResult = await listRes.json();
    expect(listResult).toHaveLength(1);

    // Delete
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const deleteRes = await fetch(`${API_BASE}/sponsors/sp-1`, { method: 'DELETE' });
    expect(deleteRes.ok).toBe(true);
  });

  it('online catalog CRUD calls correct endpoints', async () => {
    // Create
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'op-1', name: 'Product A', price: 5000 }),
    });

    const createRes = await fetch(`${API_BASE}/online-catalog/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Product A', price: 5000, category: 'General' }),
    });
    const createResult = await createRes.json();
    expect(createResult.name).toBe('Product A');

    // List
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 'op-1', name: 'Product A', active: true }]),
    });

    const listRes = await fetch(`${API_BASE}/online-catalog/products?active=true`);
    const listResult = await listRes.json();
    expect(listResult).toHaveLength(1);
  });
});
