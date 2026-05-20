import { describe, it, expect } from 'vitest';

/**
 * Kitchen transition rules - pure function tests.
 * Mirrors the server-side VALID_TRANSITIONS in kitchen.service.ts
 */

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['preparing'],
  preparing: ['ready'],
  ready: ['delivered'],
  delivered: [],
};

function canTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

describe('Kitchen transitions', () => {
  it('allows pending -> preparing', () => {
    expect(canTransition('pending', 'preparing')).toBe(true);
  });

  it('allows preparing -> ready', () => {
    expect(canTransition('preparing', 'ready')).toBe(true);
  });

  it('allows ready -> delivered', () => {
    expect(canTransition('ready', 'delivered')).toBe(true);
  });

  it('blocks delivered -> any (terminal state)', () => {
    expect(canTransition('delivered', 'pending')).toBe(false);
    expect(canTransition('delivered', 'preparing')).toBe(false);
    expect(canTransition('delivered', 'ready')).toBe(false);
    expect(canTransition('delivered', 'delivered')).toBe(false);
  });

  it('blocks skip transitions (pending -> ready)', () => {
    expect(canTransition('pending', 'ready')).toBe(false);
    expect(canTransition('pending', 'delivered')).toBe(false);
    expect(canTransition('preparing', 'delivered')).toBe(false);
  });

  it('blocks backward transitions', () => {
    expect(canTransition('preparing', 'pending')).toBe(false);
    expect(canTransition('ready', 'preparing')).toBe(false);
    expect(canTransition('delivered', 'ready')).toBe(false);
  });

  it('rejects invalid status values', () => {
    expect(canTransition('invalid', 'pending')).toBe(false);
    expect(canTransition('pending', 'invalid')).toBe(false);
  });
});
