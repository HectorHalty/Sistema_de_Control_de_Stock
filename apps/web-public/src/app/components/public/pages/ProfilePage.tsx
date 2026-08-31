import { useEffect, useState } from 'react';
import {
  Calendar,
  Loader2,
  LogOut,
  Search,
  Shield,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { publicApi, type PublicTeamOption } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { LoginPanel } from '../auth/LoginPanel';

function rolLabel(rol: string) {
  switch (rol) {
    case 'capitan':
      return 'Capitán';
    case 'jugador':
      return 'Jugador';
    case 'seguidor':
      return 'Seguidor';
    default:
      return 'Usuario';
  }
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, meContext, token, loading, logout, refreshContext, applyAuthResponse } =
    usePublicAuth();
  const [teams, setTeams] = useState<PublicTeamOption[]>([]);
  const [search, setSearch] = useState('');
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.puedeSeguirEquipo) return;
    const t = setTimeout(() => {
      publicApi
        .teams(search || undefined)
        .then(setTeams)
        .catch(() => setTeams([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search, user?.puedeSeguirEquipo]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#6BFF9E]">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="space-y-6 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
        <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="rounded-2xl p-6 text-center">
          <UserRound className="mx-auto mb-3 text-[#6BFF9E]" size={40} />
          <h2 className="text-xl font-black text-white">Tu perfil</h2>
          <p className="mt-2 text-sm text-gray-400">
            Iniciá sesión para ver tu equipo, estadísticas y administrar el plantel.
          </p>
        </div>
        <LoginPanel />
      </div>
    );
  }

  async function handleFollow(equipoInscripcionId: string) {
    if (!token) return;
    setFollowLoading(true);
    setError(null);
    try {
      const res = await publicApi.me.followTeam(equipoInscripcionId, token);
      await applyAuthResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo seguir el equipo');
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleUnfollow() {
    if (!token) return;
    setFollowLoading(true);
    setError(null);
    try {
      const res = await publicApi.me.unfollowTeam(token);
      await applyAuthResponse(res);
      await refreshContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dejar de seguir');
    } finally {
      setFollowLoading(false);
    }
  }

  const ctx = meContext;
  const stats = ctx?.personalStats;

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="overflow-hidden rounded-2xl">
        <div className="flex items-center gap-4 p-5">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-[3px] border-lch-accent">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#161616] text-lg font-black text-lch-accent">
                {user.email.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-lch-accent">
              {rolLabel(user.rol)}
            </p>
            <h2 className="truncate text-lg font-black">{user.email}</h2>
            {user.dniConfirmado && (
              <p className="mt-0.5 text-sm text-gray-500">DNI {user.dniConfirmado}</p>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white"
          >
            <LogOut size={14} />
            Salir
          </button>
        </div>
      </div>

      {ctx?.equipo && (
        <section className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
          <div className="mb-2 flex items-center gap-2 text-lch-accent">
            <Shield size={18} />
            <h3 className="font-semibold">Mi equipo</h3>
          </div>
          <p className="text-xl font-bold">{ctx.equipo.name}</p>
          {ctx.equipo.categoria && (
            <p className="mt-1 text-sm text-gray-500">{ctx.equipo.categoria}</p>
          )}

          {ctx.proximoPartido && (
            <div className="mt-4 rounded-xl bg-[#161616] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-lch-accent">
                <Calendar size={16} />
                Próximo partido
              </div>
              <p className="font-medium">
                {ctx.proximoPartido.local} vs {ctx.proximoPartido.visitante}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {new Date(ctx.proximoPartido.fecha).toLocaleDateString('es-AR')}
                {ctx.proximoPartido.hora ? ` · ${ctx.proximoPartido.hora}` : ''}
                {ctx.proximoPartido.cancha ? ` · ${ctx.proximoPartido.cancha}` : ''}
              </p>
            </div>
          )}

          {user.rol === 'seguidor' && (
            <button
              type="button"
              disabled={followLoading}
              onClick={handleUnfollow}
              className="mt-4 text-sm text-red-300 underline"
            >
              Dejar de seguir
            </button>
          )}
        </section>
      )}

      {stats && (
        <section className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
          <h3 className="mb-3 font-semibold">Mis estadísticas</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-[#161616] p-3">
              <p className="text-2xl font-bold text-lch-accent">{stats.goles}</p>
              <p className="text-xs text-gray-500">Goles</p>
            </div>
            <div className="rounded-xl bg-[#161616] p-3">
              <p className="text-2xl font-bold text-yellow-400">{stats.amarillas}</p>
              <p className="text-xs text-gray-500">Amarillas</p>
            </div>
            <div className="rounded-xl bg-[#161616] p-3">
              <p className="text-2xl font-bold text-red-400">{stats.rojas}</p>
              <p className="text-xs text-gray-500">Rojas</p>
            </div>
          </div>
        </section>
      )}

      {user.rol === 'capitan' && (
        <button
          type="button"
          onClick={() => navigate('/administrar-equipo')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-3 font-black text-[#0e0e0e]"
        >
          <Users size={18} />
          Administrar equipo
        </button>
      )}

      {user.puedeSeguirEquipo && (
        <section className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
          <div className="mb-3 flex items-center gap-2 text-lch-accent">
            <Star size={18} />
            <h3 className="font-semibold">Seguir un equipo</h3>
          </div>
          <p className="mb-4 text-sm text-gray-400">
            Elegí un equipo del torneo activo para ver su fixture y posición.
          </p>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar equipo..."
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-lch-accent"
            />
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {teams.map((t) => (
              <button
                key={t.equipoInscripcionId}
                type="button"
                disabled={followLoading}
                onClick={() => handleFollow(t.equipoInscripcionId)}
                className="flex w-full items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-3 text-left text-sm hover:border-lch-accent/40"
              >
                <span>
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-gray-500">{t.categoria}</span>
                </span>
                <Star size={16} className="text-lch-accent" />
              </button>
            ))}
            {!teams.length && (
              <p className="py-4 text-center text-sm text-gray-500">Sin equipos</p>
            )}
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
