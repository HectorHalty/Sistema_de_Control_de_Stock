import { describe, expect, it } from 'vitest';
import * as adapters from './adapters';

describe('API-first: sin fallback local', () => {
  it('no exporta shouldAllowLocalFallback', () => {
    expect('shouldAllowLocalFallback' in adapters).toBe(false);
  });

  it('no exporta useKitchenApiAdapter (KDS usa fetch+Bearer en CocinaOnlinePanel)', () => {
    expect('useKitchenApiAdapter' in adapters).toBe(false);
  });
});
