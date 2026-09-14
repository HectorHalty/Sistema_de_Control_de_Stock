import { describe, expect, it } from 'vitest';
import * as adapters from './adapters';

describe('API-first: sin fallback local', () => {
  it('no exporta shouldAllowLocalFallback', () => {
    expect('shouldAllowLocalFallback' in adapters).toBe(false);
  });
});
