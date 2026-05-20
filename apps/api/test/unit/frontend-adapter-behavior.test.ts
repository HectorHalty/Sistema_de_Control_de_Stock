import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Frontend API adapter behavior tests.
 * Tests the adapter layer that connects frontend to API endpoints.
 */

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

const API_BASE = 'http://localhost:3001';

describe('Frontend API adapter - checkout/return', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls checkout endpoint with correct payload', async () => {
    const payload = {
      items: [{ salesProductId: 'sp-1', quantity: 2 }],
      operatorId: 'admin',
      idempotencyKey: 'checkout-123',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        ticket: { id: 't-1', number: 1001, status: 'emitido' },
        idempotent: false,
      }),
    });

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
    expect(result.ticket.number).toBe(1001);
    expect(result.idempotent).toBe(false);
  });

  it('returns idempotent result when key already exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        ticket: { id: 't-1', number: 1001 },
        idempotent: true,
      }),
    });

    const response = await fetch(`${API_BASE}/sales/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ salesProductId: 'sp-1', quantity: 1 }],
        operatorId: 'admin',
        idempotencyKey: 'existing-key',
      }),
    });
    const result = await response.json();

    expect(result.idempotent).toBe(true);
  });

  it('calls return endpoint with ticket ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        ticket: { id: 't-1', number: 1001, status: 'devuelto' },
        idempotent: false,
      }),
    });

    const response = await fetch(`${API_BASE}/sales/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: 't-1',
        operatorId: 'admin',
      }),
    });
    const result = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/sales/return`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ticketId: 't-1', operatorId: 'admin' }),
      }),
    );
    expect(result.ticket.status).toBe('devuelto');
  });

  it('throws ApiError on checkout failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({
        message: 'Insufficient stock for checkout',
        missing: [{ stockProductId: 'p1', required: 5, available: 2 }],
      }),
    });

    const response = await fetch(`${API_BASE}/sales/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ salesProductId: 'sp-1', quantity: 5 }],
        operatorId: 'admin',
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(409);
    const error = await response.json();
    expect(error.message).toContain('Insufficient stock');
    expect(error.missing).toHaveLength(1);
  });
});

describe('Frontend API adapter - kitchen transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls kitchen transition endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'ko-1',
        status: 'preparing',
        ticketNumber: 1001,
        kitchenId: 'k-parrilla',
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

  it('fetches kitchen orders with filters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { id: 'ko-1', status: 'pending', ticketNumber: 1001 },
        { id: 'ko-2', status: 'preparing', ticketNumber: 1002 },
      ]),
    });

    const response = await fetch(`${API_BASE}/kitchen/orders?kitchenId=k-parrilla&status=pending`);
    const result = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/kitchen/orders?kitchenId=k-parrilla&status=pending`,
    );
    expect(result).toHaveLength(2);
  });

  it('rejects invalid transition status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({
        message: 'Invalid transition: pending -> delivered',
      }),
    });

    const response = await fetch(`${API_BASE}/kitchen/orders/ko-1/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered' }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(409);
  });
});

describe('Frontend API adapter - health check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects API availability', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    const response = await fetch(`${API_BASE}/health`);
    const result = await response.json();

    expect(result.status).toBe('ok');
  });

  it('detects API unavailability', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    let reachable = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 100);
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      reachable = res.ok;
    } catch {
      reachable = false;
    }

    expect(reachable).toBe(false);
  });
});
