import type { TestPrinterPayload } from '@/app/api/client';

type CachedTest = {
  at: number;
  result: { ok: boolean; apiUnavailable?: boolean; error?: string };
};

const CACHE_TTL_MS = 12_000;
const cache = new Map<string, CachedTest>();

function cacheKey(payload: TestPrinterPayload): string {
  return `${payload.ip}:${payload.port}`;
}

export function getCachedPrinterTest(
  payload: TestPrinterPayload,
): CachedTest['result'] | null {
  const hit = cache.get(cacheKey(payload));
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  return hit.result;
}

export function setCachedPrinterTest(
  payload: TestPrinterPayload,
  result: CachedTest['result'],
): void {
  cache.set(cacheKey(payload), { at: Date.now(), result });
}

export function invalidatePrinterTestCache(ip?: string, port?: number): void {
  if (ip != null && port != null) {
    cache.delete(`${ip}:${port}`);
    return;
  }
  cache.clear();
}
