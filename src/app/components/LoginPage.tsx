import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { CurrentUser } from './store';

import logo from '../../assets/logo-chacra.png';

interface LoginPageProps {
  onLogin: (user: CurrentUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !password) {
      setError('Por favor completá ambos campos.');
      return;
    }

    // Mock auth por roles LCH
    const normalizedUser = user.trim().toLowerCase();
    const normalizedPassword = password.trim().toLowerCase();

    if ((normalizedUser === 'superadmin' && normalizedPassword === 'superadmin') || (normalizedUser === 'admin' && normalizedPassword === 'admin')) {
      onLogin({ username: 'superadmin', role: 'SuperAdmin' });
      return;
    }

    if (normalizedUser === 'gerente' && normalizedPassword === 'gerente') {
      onLogin({ username: 'gerente.operaciones', role: 'Gerente_Operaciones' });
      return;
    }

    if (normalizedUser === 'stock' && normalizedPassword === 'stock') {
      onLogin({ username: 'encargado.stock', role: 'Encargado_Stock' });
      return;
    }

    if (normalizedUser === 'futbol' && normalizedPassword === 'futbol') {
      onLogin({ username: 'encargado.futbol', role: 'Encargado_Futbol' });
      return;
    }

    onLogin({ username: user, role: 'Gerente_Operaciones' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="La Chacra Fútbol" className="logo-sidebar w-56 h-56 mb-4 object-contain" />
          <h1 className="text-foreground tracking-wide">Control de Stock</h1>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-8 border border-border">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200 text-sm">
                {error}
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
              className="w-full bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white py-3 rounded-lg transition-colors shadow-sm"
            >
              Ingresar
            </button>

            <div className="text-center">
              <button type="button" className="text-[#3d7a3d] hover:underline text-sm">
                Olvidé mi contraseña
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Demo: superadmin/superadmin - gerente/gerente - stock/stock - futbol/futbol
        </p>
      </div>
    </div>
  );
}
