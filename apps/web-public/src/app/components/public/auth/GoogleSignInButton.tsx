import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { usePublicAuth } from './PublicAuthContext';
import { googleEnabled } from './auth-helpers';

export function GoogleSignInButton() {
  const { loginGoogle } = usePublicAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!googleEnabled(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)) {
    return null;
  }

  async function handle(credential?: string) {
    if (!credential) {
      setError('No se recibió el token de Google');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loginGoogle(credential);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className={loading ? 'pointer-events-none opacity-60' : ''}>
        <GoogleLogin
          theme="filled_black"
          text="continue_with"
          width="100%"
          onSuccess={(cred) => void handle(cred.credential)}
          onError={() => setError('No se pudo iniciar sesión con Google')}
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">{error}</p>
      )}
    </div>
  );
}
