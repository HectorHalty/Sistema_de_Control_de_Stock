import { useState } from 'react';
import { Loader2, LogOut, Pencil, Shield, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PublicRol } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { useFutbolIdentity } from '../auth/useFutbolIdentity';
import { OnboardingBody } from '../auth/OnboardingGate';
import { JugadorDniStep } from '../auth/JugadorDniStep';
import { TeamPicker } from '../auth/TeamPicker';
import { LoginPanel } from '../auth/LoginPanel';
import { IconClock, IconMapPin, RivalMark, StarBadge } from '../figma-icons';

/** Etiqueta del rol. `usuario` es un estado de larga vida (el DNI no es
 *  obligatorio y "Más tarde" es de primera clase), y todavía no sigue a ningún
 *  equipo: no puede mostrarse como "Seguidor". */
function rolLabel(rol: PublicRol): string {
  switch (rol) {
    case 'capitan':
      return 'Capitán';
    case 'jugador':
      return 'Jugador';
    case 'seguidor':
      return 'Seguidor';
    default:
      return 'Sin vincular';
  }
}

function formatMatchDate(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(iso))
    .toUpperCase();
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, loading, logout } = usePublicAuth();
  const { role, meContext, followTeam, unfollowTeam, torneoPublico } = useFutbolIdentity();
  const [mostrarPasoJugador, setMostrarPasoJugador] = useState(false);

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
            Iniciá sesión para ver tu equipo, datos personales y administrar el plantel.
          </p>
        </div>
        <LoginPanel />
      </div>
    );
  }

  const ctx = meContext;
  const name = user.nombre ?? user.email;
  const next = ctx?.proximoPartido;
  const suspension = ctx?.personalStats?.suspensiones?.[0] as
    | { motivo?: string; fechasRestantes?: number; equipo?: string }
    | undefined;

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="overflow-hidden rounded-2xl">
        <div className="flex items-center gap-4 p-5">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-[3px] border-lch-accent">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#161616] text-lg font-black text-lch-accent">
                {name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black text-white">{name}</h2>
            {ctx?.equipo && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[#6BFF9E]">
                <Shield size={14} />
                {ctx.equipo.name}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[#161616] px-2 py-0.5 text-[10px] font-bold text-gray-400">
                {rolLabel(user.rol)}
              </span>
              {ctx?.equipo?.categoria && (
                <span className="rounded-full bg-[#161616] px-2 py-0.5 text-[10px] font-bold text-gray-400">
                  {ctx.equipo.categoria}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1 rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white"
            >
              <LogOut size={14} />
              Salir
            </button>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6BFF9E]">
              <Pencil size={12} /> Editar
            </span>
          </div>
        </div>
      </div>

      {next && (
        <div
          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14, overflow: 'hidden' }}
        >
          <div
            style={{ background: '#161616', borderBottom: '1px solid #222' }}
            className="flex items-center justify-between px-5 pb-2.5 pt-3"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-white">Próximo Partido</p>
            <span
              style={{ background: '#6BFF9E18', color: '#6BFF9E', border: '1px solid #6BFF9E33' }}
              className="rounded-full px-2.5 py-1 text-[9px] font-black"
            >
              {formatMatchDate(next.fecha)}
              {next.hora ? ` · ${next.hora}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6BFF9E15]">
                <StarBadge />
              </div>
              <p className="truncate text-sm font-black text-white">{next.local}</p>
              <p className="text-[10px] text-gray-500">Local</p>
            </div>
            <p className="text-2xl font-black text-[#6BFF9E]">VS</p>
            <div className="min-w-0 flex-1 text-right">
              <div className="mb-1 ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#252525]">
                <RivalMark />
              </div>
              <p className="truncate text-sm font-black text-white">{next.visitante}</p>
              <p className="text-[10px] text-gray-500">Visitante</p>
            </div>
          </div>
          <div className="flex gap-4 px-5 pb-4 text-[11px] text-gray-500">
            {next.cancha && (
              <span className="inline-flex items-center gap-1">
                <IconMapPin /> {next.cancha}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <IconClock /> {ctx?.equipo?.categoria ?? 'Torneo'}
            </span>
          </div>
        </div>
      )}

      {suspension && (
        <div
          style={{ background: '#3a1010', border: '1px solid #ef444466' }}
          className="flex items-center justify-between rounded-2xl px-5 py-4"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-400">Jugador suspendido</p>
            <p className="mt-1 text-sm text-red-200">
              {typeof suspension.motivo === 'string' ? suspension.motivo : 'Sanción activa en el torneo.'}
            </p>
          </div>
          {typeof suspension.fechasRestantes === 'number' && (
            <span className="shrink-0 rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white">
              -{suspension.fechasRestantes} fechas
            </span>
          )}
        </div>
      )}

      {role.rol === 'jugador' && meContext?.personalStats && (
        <section style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Mi rendimiento</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Goles', meContext.personalStats.goles],
              ['Amarillas', meContext.personalStats.amarillas],
              ['Rojas', meContext.personalStats.rojas],
            ].map(([label, n]) => (
              <div key={label} className="rounded-xl bg-[#161616] p-3 text-center">
                <p className="text-2xl font-black text-white">{n}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          {(() => {
            const st = meContext.standingsPosition;
            if (!st) return null;
            const torneo = torneoPublico();
            // Posición = índice en la tabla + 1. `findIndex` devuelve -1 si el
            // equipo no está en la tabla; en ese caso omitimos el "Nº en …".
            const puesto =
              torneo.standings.findIndex((s) => s.inscripcionId === st.inscripcionId) + 1;
            return (
              <p className="mt-3 text-xs text-gray-400">
                {meContext.equipo?.name}: {st.played} PJ · {st.points} pts
                {puesto > 0 ? ` · ${puesto}º en ${torneo.torneo.nombre}` : ''}
              </p>
            );
          })()}
        </section>
      )}

      <section style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-bold text-white">Datos Personales</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Nombre completo</p>
            <p className="mt-1 text-sm font-semibold text-white">{name}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Email</p>
            <p className="mt-1 text-sm font-semibold text-white">{user.email}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Teléfono</p>
            <p className="mt-1 text-sm font-semibold text-gray-400">No cargado</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">DNI</p>
            <p className="mt-1 text-sm font-semibold text-white">{user.dniConfirmado ?? 'Pendiente'}</p>
          </div>
        </div>
      </section>

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

      <section style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="rounded-2xl p-5">
        <h3 className="mb-3 text-sm font-bold text-white">Mi vínculo con el torneo</h3>

        {role.rol === 'jugador' || role.rol === 'capitan' ? (
          <p className="text-sm text-gray-300">
            Estás vinculado como {role.rol === 'capitan' ? 'capitán' : 'jugador'} de{' '}
            <span className="font-bold text-lch-accent">{meContext?.equipo?.name ?? 'tu equipo'}</span>.
          </p>
        ) : role.rol === 'seguidor' ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              Seguís a <span className="font-bold text-lch-accent">{meContext?.equipo?.name}</span>.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => { unfollowTeam(); }} className="text-sm text-red-300 underline">
                Dejar de seguir
              </button>
              {!mostrarPasoJugador && (
                <button
                  type="button"
                  onClick={() => setMostrarPasoJugador(true)}
                  className="text-sm text-lch-accent underline"
                >
                  Soy jugador
                </button>
              )}
            </div>
            {mostrarPasoJugador ? (
              <div className="rounded-xl border border-[#2a2a2a] bg-[#161616] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-black text-white">Confirmá tu DNI</h4>
                  <button
                    type="button"
                    onClick={() => setMostrarPasoJugador(false)}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
                {/* Al confirmar, `completeDni` refresca la sesión y el rol efectivo
                    se re-deriva solo: no hace falta cerrar nada a mano. */}
                <JugadorDniStep onDone={() => {}} />
              </div>
            ) : (
              <TeamPicker onPick={(id) => { followTeam(id); }} />
            )}
          </div>
        ) : (
          <OnboardingBody onClose={() => {}} showDismiss={false} />
        )}
      </section>
    </div>
  );
}
