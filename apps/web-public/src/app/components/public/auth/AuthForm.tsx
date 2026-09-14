import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { usePublicAuth } from './PublicAuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import { googleEnabled } from './auth-helpers';

type Mode = 'login' | 'register';

const inputClass =
  'w-full rounded-lg border border-[#3a3a3a] bg-[#242424] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-lch-accent';

export function AuthForm({ defaultMode = 'login' }: { defaultMode?: Mode }) {
  const { login, register } = usePublicAuth();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nombre, setNombre] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        return;
      }
      if (password !== confirm) {
        setError('Las contraseñas no coinciden');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ email, password, nombre });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {googleEnabled(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) && (
        <>
          <GoogleSignInButton />
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <div className="h-px flex-1 bg-[#2a2a2a]" />
            o
            <div className="h-px flex-1 bg-[#2a2a2a]" />
          </div>
        </>
      )}
      <div className="flex gap-2 rounded-xl border border-[#2a2a2a] bg-[#161616] p-1">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-colors ${
            mode === 'login' ? 'bg-lch-accent text-[#0e0e0e]' : 'text-gray-400'
          }`}
        >
          <LogIn size={16} />
          Ingresar
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-colors ${
            mode === 'register' ? 'bg-lch-accent text-[#0e0e0e]' : 'text-gray-400'
          }`}
        >
          <UserPlus size={16} />
          Registrarse
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'register' && (
          <>
            <input
              className={inputClass}
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </>
        )}
        <input
          type="email"
          className={inputClass}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          className={inputClass}
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {mode === 'register' && (
          <input
            type="password"
            className={inputClass}
            placeholder="Confirmar contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        )}

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-3 text-sm font-black text-[#0e0e0e] disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-center text-[10px] text-gray-600">
        Prueba: capitan@lachacra.test / capitan123 · jugador@lachacra.test / jugador123
      </p>
    </div>
  );
}
