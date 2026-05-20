import { describe, it, expect } from 'vitest';

/**
 * Idempotency key tests.
 * Verifies the idempotency pattern used in checkout/return endpoints.
 *
 * Server-side: checks for existing idempotencyKey before processing.
 * If found, returns the existing result without re-processing.
 */

interface IdempotencyStore {
  get(key: string): unknown | undefined;
  set(key: string, value: unknown): void;
}

class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, unknown>();
  get(key: string) { return this.store.get(key); }
  set(key: string, value: unknown) { this.store.set(key, value); }
}

function processCheckoutWithIdempotency(
  store: IdempotencyStore,
  idempotencyKey: string | undefined,
  processFn: () => { ticketId: string; total: number },
): { result: { ticketId: string; total: number }; idempotent: boolean } {
  if (idempotencyKey) {
    const existing = store.get(idempotencyKey);
    if (existing) {
      return { result: existing as { ticketId: string; total: number }, idempotent: true };
    }
  }

  const result = processFn();

  if (idempotencyKey) {
    store.set(idempotencyKey, result);
  }

  return { result, idempotent: false };
}

describe('Idempotent checkout/return', () => {
  it('processes first request normally without idempotency key', () => {
    const store = new InMemoryIdempotencyStore();
    let callCount = 0;

    const { result, idempotent } = processCheckoutWithIdempotency(
      store,
      undefined,
      () => {
        callCount++;
        return { ticketId: 't-1', total: 5000 };
      },
    );

    expect(idempotent).toBe(false);
    expect(result.ticketId).toBe('t-1');
    expect(callCount).toBe(1);
  });

  it('returns cached result for duplicate idempotency key', () => {
    const store = new InMemoryIdempotencyStore();
    let callCount = 0;

    const process = () => {
      callCount++;
      return { ticketId: `t-${callCount}`, total: 5000 };
    };

    // First call
    const r1 = processCheckoutWithIdempotency(store, 'key-1', process);
    expect(r1.idempotent).toBe(false);
    expect(r1.result.ticketId).toBe('t-1');

    // Second call with same key - should return cached
    const r2 = processCheckoutWithIdempotency(store, 'key-1', process);
    expect(r2.idempotent).toBe(true);
    expect(r2.result.ticketId).toBe('t-1'); // same as first
    expect(callCount).toBe(1); // processFn NOT called again
  });

  it('processes different idempotency keys independently', () => {
    const store = new InMemoryIdempotencyStore();
    let callCount = 0;

    const process = () => {
      callCount++;
      return { ticketId: `t-${callCount}`, total: 5000 };
    };

    const r1 = processCheckoutWithIdempotency(store, 'key-1', process);
    const r2 = processCheckoutWithIdempotency(store, 'key-2', process);

    expect(r1.idempotent).toBe(false);
    expect(r2.idempotent).toBe(false);
    expect(r1.result.ticketId).toBe('t-1');
    expect(r2.result.ticketId).toBe('t-2');
    expect(callCount).toBe(2);
  });

  it('handles return idempotency the same way', () => {
    const store = new InMemoryIdempotencyStore();
    let returnCount = 0;

    const processReturn = () => {
      returnCount++;
      return { ticketId: 't-1', total: 0, ok: true, status: 'devuelto' };
    };

    const r1 = processCheckoutWithIdempotency(store, 'return-key-1', processReturn);
    const r2 = processCheckoutWithIdempotency(store, 'return-key-1', processReturn);

    expect(r1.idempotent).toBe(false);
    expect(r2.idempotent).toBe(true);
    expect(returnCount).toBe(1);
  });
});
