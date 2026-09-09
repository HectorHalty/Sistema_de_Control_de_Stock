import type { PublicSessionUser } from '../../../api/public-api';

export function googleEnabled(clientId?: string | null): boolean {
  return typeof clientId === 'string' && clientId.trim().length > 0;
}

export function shouldShowOnboarding(
  user: PublicSessionUser | null,
  dismissed: boolean,
): boolean {
  return !!user && user.rol === 'usuario' && !dismissed;
}
