/** Normaliza token QR de retiro (trim + uppercase). */
export function normalizeQrToken(token: string): string {
  return token.trim().toUpperCase();
}
