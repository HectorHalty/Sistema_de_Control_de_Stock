import { GoogleLogin } from '@react-oauth/google';
import { Loader2, LogIn } from 'lucide-react';
import { useState } from 'react';
import { usePublicAuth } from './PublicAuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const IS_DEV = import.meta.env.DEV;

const DEV_ACCOUNTS = [
  { email: 'capitan.demo@lachacra.test', name: 'Capitán Demo', label: 'Capitán demo' },
  { email: 'juan.perez@demo.test', name: 'Juan Pérez', label: 'Jugador demo' },
];

export function LoginPanel() {
  const { loginDev, loginGoogle } = usePublicAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDevLogin(email: string, name: string) {
    setError(null);
    setLoading(email);
    try {
      await loginDev(email, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {GOOGLE_CLIENT_ID ? (
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={(res) => {
              if (!res.credential) return;
              setLoading('google');
              loginGoogle(res.credential)
                .catch((err: Error) => setError(err.message))
                .finally(() => setLoading(null));
            }}
            onError={() => setError('No se pudo iniciar sesión con Google')}
            theme="filled_black"
            shape="pill"
            text="signin_with"
            locale="es"
          />
        </div>
      ) : IS_DEV ? (
        <div className="space-y-2">
          <p className="text-center text-xs text-gray-500">Modo desarrollo — accesos demo</p>
          {DEV_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              disabled={!!loading}
              onClick={() => handleDevLogin(acc.email, acc.name)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-lch-accent/30 bg-lch-accent/10 px-4 py-3 text-sm font-bold text-lch-accent disabled:opacity-50"
            >
              {loading === acc.email ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <LogIn size={16} />
              )}
              {acc.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-[#2a2a2a] bg-[#161616] p-4 text-center text-sm text-gray-500">
          Inicio de sesión con Google no configurado.
        </p>
      )}

      {loading === 'google' && (
        <div className="flex justify-center text-lch-accent">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
