import { describe, expect, it } from 'vitest';
import { normalizeQrToken } from '../src/online/qr-token.util';

describe('normalizeQrToken', () => {
  it('recorta espacios y pasa a mayúsculas', () => {
    expect(normalizeQrToken('  abc123xyz  ')).toBe('ABC123XYZ');
  });

  it('es idempotente', () => {
    const once = normalizeQrToken('token-demo');
    expect(normalizeQrToken(once)).toBe('TOKEN-DEMO');
  });
});
