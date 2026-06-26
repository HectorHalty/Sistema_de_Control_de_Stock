import { Capacitor } from '@capacitor/core';

/** URLs baked at build time that only work on the dev machine, not in prod browsers/APK. */
function isLocalDevApiUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * When the admin SPA was built with localhost/127.0.0.1 (common Docker mistake),
 * derive the public API URL from where the user actually opened the app.
 */
function inferApiUrlFromContext(): string | null {
  if (typeof window === 'undefined') return null;

  const { hostname, protocol } = window.location;

  if (hostname === 'lachacrafutbol.duckdns.org') {
    return 'https://lachacra-api.duckdns.org';
  }

  if (hostname.startsWith('admin.')) {
    const rest = hostname.slice('admin.'.length);
    return `${protocol}//api.${rest}`;
  }

  if (Capacitor.isNativePlatform()) {
    const built = import.meta.env.VITE_API_URL as string | undefined;
    if (built && !isLocalDevApiUrl(built)) return built;
    return 'https://lachacra-api.duckdns.org';
  }

  return null;
}

export function resolveApiBaseUrl(): string {
  const built = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  if (built && !isLocalDevApiUrl(built)) {
    return built.replace(/\/$/, '');
  }

  const inferred = inferApiUrlFromContext();
  if (inferred) {
    return inferred.replace(/\/$/, '');
  }

  return built || 'http://localhost:3001';
}
