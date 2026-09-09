import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

// Mock google-auth-library ANTES de importar el servicio
const verifyIdToken = vi.fn();
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({ verifyIdToken })),
}));

import { PublicAuthService } from '../src/public/public-auth.service';

function makeService() {
  const prisma = {} as never;
  const jwt = { sign: () => 'tok' } as never;
  const config = {
    get: (k: string) => (k === 'GOOGLE_CLIENT_ID' ? 'client-123' : undefined),
  } as never;
  return new PublicAuthService(prisma, jwt, config);
}

describe('verifyGoogleToken — email verificado', () => {
  it('rechaza un token cuyo email no está verificado', async () => {
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ sub: 'g-1', email: 'x@gmail.com', email_verified: false, name: 'X' }),
    });
    const svc = makeService();
    // verifyGoogleToken es privado: se ejerce vía loginWithGoogle
    await expect(svc.loginWithGoogle('fake-id-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
