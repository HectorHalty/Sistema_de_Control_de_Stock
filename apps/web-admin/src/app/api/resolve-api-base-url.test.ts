import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('resolveApiBaseUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses production build URL when not localhost', async () => {
    vi.stubEnv('VITE_API_URL', 'https://lachacra-api.duckdns.org');
    const { resolveApiBaseUrl } = await import('./resolve-api-base-url');
    expect(resolveApiBaseUrl()).toBe('https://lachacra-api.duckdns.org');
  });

  it('infers API from DuckDNS admin host when build used 127.0.0.1', async () => {
    vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:3001');
    vi.stubGlobal('window', {
      location: { hostname: 'lachacrafutbol.duckdns.org', protocol: 'https:' },
    });
    const { resolveApiBaseUrl } = await import('./resolve-api-base-url');
    expect(resolveApiBaseUrl()).toBe('https://lachacra-api.duckdns.org');
  });

  it('infers API from www DuckDNS admin host', async () => {
    vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:3001');
    vi.stubGlobal('window', {
      location: { hostname: 'www.lachacrafutbol.duckdns.org', protocol: 'https:' },
    });
    const { resolveApiBaseUrl } = await import('./resolve-api-base-url');
    expect(resolveApiBaseUrl()).toBe('https://lachacra-api.duckdns.org');
  });

  it('falls back to localhost in dev', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', protocol: 'http:' },
    });
    const { resolveApiBaseUrl } = await import('./resolve-api-base-url');
    expect(resolveApiBaseUrl()).toBe('http://localhost:3001');
  });
});
