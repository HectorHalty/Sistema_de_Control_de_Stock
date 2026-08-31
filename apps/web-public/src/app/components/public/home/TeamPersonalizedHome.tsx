import { Calendar, MapPin, Shield, TrendingUp } from 'lucide-react';
import type { MeContext } from '../../../api/public-api';

interface TeamPersonalizedHomeProps {
  context: MeContext;
}

export function TeamPersonalizedHome({ context }: TeamPersonalizedHomeProps) {
  const { equipo, proximoPartido, standingsPosition, personalStats, tieneStatsPersonales } =
    context;

  if (!equipo) return null;

  const standing = standingsPosition as {
    position?: number;
    points?: number;
    played?: number;
  } | null;

  return (
    <div className="space-y-4">
      {proximoPartido && (
        <div className="overflow-hidden rounded-[14px] border border-[#2a2a2a] bg-lch-card">
          <div className="flex items-center justify-between border-b border-[#222] bg-[#161616] px-5 pb-2.5 pt-3">
            <p className="text-xs font-bold uppercase tracking-widest text-white">
              Mi Próximo Partido
            </p>
            <span className="flex items-center gap-1.5 rounded-full border border-lch-accent/20 bg-lch-accent/10 px-2.5 py-1 text-[9px] font-black text-lch-accent">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-lch-accent" />
              {new Date(proximoPartido.fecha).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short',
              }).toUpperCase()}
              {proximoPartido.hora ? ` · ${proximoPartido.hora}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 px-5 py-4 sm:gap-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black leading-tight">{proximoPartido.local}</p>
              <p className="text-xs text-gray-500">
                {proximoPartido.esLocal ? 'Local' : 'Visitante'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black leading-none text-lch-accent">VS</p>
              {proximoPartido.cancha && (
                <p className="mt-1.5 flex items-center justify-center gap-0.5 text-[10px] text-gray-600">
                  <MapPin size={10} />
                  {proximoPartido.cancha}
                </p>
              )}
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-base font-black leading-tight">{proximoPartido.visitante}</p>
              <p className="text-xs text-gray-500">
                {proximoPartido.esLocal ? 'Visitante' : 'Local'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
          <div className="mb-3 flex items-center gap-2 text-lch-accent">
            <Shield size={16} />
            <h3 className="text-sm font-bold text-white">Tu equipo</h3>
          </div>
          <h2 className="text-xl font-black">{equipo.name}</h2>
          {equipo.categoria && <p className="mt-1 text-sm text-gray-500">{equipo.categoria}</p>}
        </div>

        {standing && (
          <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
            <div className="mb-3 flex items-center gap-2 text-lch-accent">
              <TrendingUp size={16} />
              <h3 className="text-sm font-bold text-white">Posición en la tabla</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-lch-accent">#{standing.position ?? '—'}</span>
              <span className="text-sm text-gray-500">
                {standing.points ?? 0} pts · {standing.played ?? 0} PJ
              </span>
            </div>
          </div>
        )}
      </div>

      {tieneStatsPersonales && personalStats && (
        <div className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
          <div className="mb-3 flex items-center gap-2 text-lch-accent">
            <Calendar size={16} />
            <h3 className="text-sm font-bold text-white">Mis datos</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-[#161616] p-3">
              <p className="text-2xl font-black text-lch-accent">{personalStats.goles}</p>
              <p className="text-xs text-gray-500">Goles</p>
            </div>
            <div className="rounded-xl bg-[#161616] p-3">
              <p className="text-2xl font-black text-yellow-400">{personalStats.amarillas}</p>
              <p className="text-xs text-gray-500">Amarillas</p>
            </div>
            <div className="rounded-xl bg-[#161616] p-3">
              <p className="text-2xl font-black text-red-400">{personalStats.rojas}</p>
              <p className="text-xs text-gray-500">Rojas</p>
            </div>
          </div>
          {personalStats.suspensiones.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              Tenés suspensiones activas en el torneo.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
