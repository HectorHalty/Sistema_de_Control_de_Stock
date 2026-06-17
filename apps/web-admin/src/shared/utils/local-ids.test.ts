import { describe, expect, it } from 'vitest';
import { isLocalOnlyId } from './local-ids';

describe('isLocalOnlyId', () => {
  it('detects client-side ids', () => {
    expect(isLocalOnlyId('p1730000000')).toBe(true);
    expect(isLocalOnlyId('k-parrilla')).toBe(true);
  });

  it('detects server UUIDs', () => {
    expect(isLocalOnlyId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });
});
