import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { CurrentUser } from '@/app/components/store';
import { authApi, ApiError, getApiErrorMessage } from '@/app/api/client';
import { clearAllAppData } from '@/shared/storage/clear-app-data';

import logo from '@/assets/logo-chacra.png';

interface LoginPageProps {
  onLogin: (user: CurrentUser, token: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('reset')) {
      clearAllAppData();
      setCacheCleared(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !password) {
      setError('Por favor completá ambos campos.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(user.trim(), password);
      onLogin(
        { id: res.user.id, username: res.user.username, role: res.user.role as CurrentUser['role'] },
        res.access_token,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError('Demasiados intentos. Esperá unos segundos y volvé a probar.');
        } else if (err.message === 'Invalid credentials') {
          setError('Usuario o contraseña incorrectos.');
        } else {
          setError(err.message);
        }
      } else {
        setError(getApiErrorMessage(err, 'No se pudo conectar con el servidor'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="La Chacra Fútbol" className="logo-sidebar w-56 h-56 mb-4 object-contain" />
          <h1 className="text-foreground tracking-wide">Sistema de Gestión LCH</h1>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-8 border border-border">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg border border-red-200 dark:border-red-900 text-sm">
                {error}
              </div>
            )}
            {cacheCleared && (
              <div className="bg-[#3d7a3d]/10 text-[#3d7a3d] px-4 py-3 rounded-lg border border-[#3d7a3d]/30 text-sm">
                Datos locales borrados. La base se reinició: podés cargar todo desde cero.
              </div>
            )}

            <div>
              <label className="block mb-1.5 text-foreground">Usuario</label>
              <input
                type="text"
                value={user}
                onChange={e => { setUser(e.target.value); setError(''); }}
                className="w-full px-4 py-2.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 outline-none transition-all"
                placeholder="Ingresá tu usuario"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-foreground">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full px-4 py-2.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 outline-none transition-all pr-12"
                  placeholder="Ingresá tu contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3d7a3d] hover:bg-[#2f5f2f] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors shadow-sm"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>

            <div className="text-center">
              <button type="button" className="text-[#3d7a3d] hover:underline text-sm">
                Olvidé mi contraseña
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Usuario inicial: <span style={{ fontWeight: 600 }}>admin</span> / <span style={{ fontWeight: 600 }}>admin123</span>
        </p>
      </div>
    </div>
  );
}
