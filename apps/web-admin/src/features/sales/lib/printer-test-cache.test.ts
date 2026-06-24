import { describe, expect, it, beforeEach } from 'vitest';
import {
  getCachedPrinterTest,
  invalidatePrinterTestCache,
  setCachedPrinterTest,
} from './printer-test-cache';

describe('printer-test-cache', () => {
  beforeEach(() => {
    invalidatePrinterTestCache();
  });

  it('devuelve null si no hay entrada', () => {
    expect(getCachedPrinterTest({ ip: '192.168.1.10', port: 9100 })).toBeNull();
  });

  it('reutiliza el resultado dentro del TTL', () => {
    const payload = { ip: '192.168.1.10', port: 9100 };
    setCachedPrinterTest(payload, { ok: true, apiUnavailable: false });
    expect(getCachedPrinterTest(payload)).toEqual({ ok: true, apiUnavailable: false });
  });

  it('invalida por ip y puerto', () => {
    const payload = { ip: '192.168.1.10', port: 9100 };
    setCachedPrinterTest(payload, { ok: false, error: 'timeout' });
    invalidatePrinterTestCache(payload.ip, payload.port);
    expect(getCachedPrinterTest(payload)).toBeNull();
  });
});
