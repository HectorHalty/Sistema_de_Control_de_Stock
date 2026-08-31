import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { PageLoader } from '../../ui/PageLoader';

type Tab = 'posiciones' | 'goleadores' | 'tarjetas' | 'suspendidos' | 'fixture';

function abbr(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function difLabel(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

export function TorneoPage() {
  const [tab, setTab] = useState<Tab>('posiciones');
  const { meContext } = usePublicAuth();
  const myTeam = meContext?.equipo?.name;

  const { data, error, isLoading } = useQuery({
    queryKey: ['torneo'],
    queryFn: () => publicApi.torneo(),
  });

  if (isLoading) return <PageLoader />;

  if (error || !data) {
    return (
      <div className="mx-auto p-6" style={{ maxWidth: '56rem' }}>
        <div
          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
          className="rounded-2xl p-6 text-center text-gray-400"
        >
          {(error as Error)?.message ?? 'No hay torneo activo publicado.'}
        </div>
      </div>
    );
  }

  const played = data.partidos.filter((p) => p.status === 'jugado');
  const upcoming = data.partidos.filter((p) => p.status !== 'jugado');
  const equipos = data.equipos ?? [];

  return (
    <div className="mx-auto p-6" style={{ maxWidth: '56rem' }}>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-black text-white">Torneo La Chacra</h1>
        <p className="text-xs font-bold uppercase tracking-widest text-[#6BFF9E]">
          {data.torneo.campeonato} · {data.torneo.temporada}
        </p>
      </div>

      <div
        style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14 }}
        className="mb-5"
      >
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div style={{ width: 3, height: 18, background: '#6BFF9E', borderRadius: 2 }} />
            <span className="text-sm font-black text-white">{data.torneo.categoria}</span>
            {myTeam && (
              <span
                style={{ background: '#6BFF9E22', color: '#6BFF9E', border: '1px solid #6BFF9E44' }}
                className="rounded-full px-1.5 py-0.5 text-[9px] font-black"
              >
                MI CATEGORÍA
              </span>
            )}
          </div>
          <span className="text-sm font-black text-white">{data.torneo.nombre}</span>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ['posiciones', 'Posiciones'],
            ['goleadores', 'Goleadores'],
            ['tarjetas', 'Tarjetas'],
            ['suspendidos', 'Suspendidos'],
            ['fixture', 'Fixture'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={
              tab === id
                ? { background: '#6BFF9E22', color: '#6BFF9E', border: '1px solid #6BFF9E55' }
                : { background: 'transparent', color: '#9ca3af', border: '1px solid #2a2a2a' }
            }
            className="rounded-lg px-4 py-2 text-sm font-bold"
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'fixture' && played.length > 0 && (
        <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="mb-5 rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Últimos Resultados</p>
            {myTeam && (
              <span
                style={{ background: '#6BFF9E22', color: '#6BFF9E', border: '1px solid #6BFF9E44' }}
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              >
                {myTeam}
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {played.slice(0, 8).map((m) => {
              const isMyHome = myTeam === m.local;
              const isMyAway = myTeam === m.visitante;
              const myScore = isMyHome ? m.homeGoals : isMyAway ? m.awayGoals : m.homeGoals;
              const oppScore = isMyHome ? m.awayGoals : isMyAway ? m.homeGoals : m.awayGoals;
              const won = (myScore ?? 0) > (oppScore ?? 0);
              const drew = myScore === oppScore;
              const homeAbbr = abbr(m.local);
              const awayAbbr = abbr(m.visitante);
              return (
                <div
                  key={m.id}
                  style={{ background: '#242424', border: '1px solid #2a2a2a', minWidth: 190 }}
                  className="shrink-0 rounded-xl p-3 text-left"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] text-gray-600">
                      J{m.jornada ?? '—'}
                      {m.cancha ? ` · ${m.cancha}` : ''}
                    </p>
                    {(isMyHome || isMyAway) && (
                      <span
                        style={{
                          background: won ? '#6BFF9E22' : drew ? '#f59e0b22' : '#ef444411',
                          color: won ? '#6BFF9E' : drew ? '#f59e0b' : '#ef4444',
                          fontSize: 9,
                        }}
                        className="rounded px-1.5 py-0.5 font-black"
                      >
                        {won ? 'V' : drew ? 'E' : 'D'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      style={{ color: isMyHome ? 'white' : '#6b7280' }}
                      className="truncate text-xs font-semibold"
                    >
                      {homeAbbr}
                    </span>
                    <span style={{ color: '#6BFF9E' }} className="shrink-0 px-2 text-sm font-black">
                      {m.homeGoals}–{m.awayGoals}
                    </span>
                    <span
                      style={{ color: isMyAway ? 'white' : '#6b7280' }}
                      className="truncate text-right text-xs font-semibold"
                    >
                      {awayAbbr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'posiciones' && (
        <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="overflow-hidden rounded-xl">
          <div className="border-b border-[#2a2a2a] px-5 py-4">
            <h2 className="font-bold text-white">Tabla de Posiciones — {data.torneo.categoria}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#242424', borderBottom: '1px solid #2a2a2a' }}>
                {['Pos', 'Equipo', 'PJ', 'PG', 'PE', 'PP', 'PTS', 'DIF'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 first:pl-5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.standings.map((row, i) => {
                const highlight = myTeam === row.teamName;
                const team = equipos.find((e) => e.name === row.teamName);
                const color = team?.color || '#6BFF9E';
                const short = team?.shortName || abbr(row.teamName);
                const dif = difLabel(row.goalDiff);
                return (
                  <tr
                    key={row.inscripcionId}
                    style={{
                      borderBottom: '1px solid #242424',
                      background: highlight ? '#6BFF9E06' : 'transparent',
                    }}
                    className="hover:bg-[#242424]"
                  >
                    <td className="px-4 py-3 pl-5">
                      <span
                        style={{ color: highlight ? '#6BFF9E' : i < 3 ? 'white' : '#6b7280' }}
                        className="font-bold"
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          style={{
                            background: `${color}22`,
                            border: `1px solid ${color}44`,
                            width: 22,
                            height: 22,
                          }}
                          className="flex shrink-0 items-center justify-center rounded"
                        >
                          <span style={{ color, fontSize: 8 }} className="font-black">
                            {short.slice(0, 2)}
                          </span>
                        </div>
                        <span
                          style={{ color: highlight ? '#6BFF9E' : 'white' }}
                          className="text-sm font-semibold"
                        >
                          {row.teamName}
                        </span>
                        {highlight && (
                          <span className="rounded bg-[#6BFF9E22] px-1.5 py-0.5 text-[10px] font-bold text-[#6BFF9E]">
                            TÚ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{row.played}</td>
                    <td className="px-4 py-3 text-gray-400">{row.won}</td>
                    <td className="px-4 py-3 text-gray-400">{row.drawn}</td>
                    <td className="px-4 py-3 text-gray-400">{row.lost}</td>
                    <td className="px-4 py-3">
                      <span style={{ color: highlight ? '#6BFF9E' : 'white' }} className="font-bold">
                        {row.points}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        style={{
                          color: row.goalDiff > 0 ? '#6BFF9E' : row.goalDiff === 0 ? '#9ca3af' : '#ef4444',
                        }}
                        className="font-semibold"
                      >
                        {dif}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(tab === 'goleadores' || tab === 'tarjetas' || tab === 'suspendidos') && (
        <div
          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
          className="rounded-xl px-5 py-10 text-center text-sm text-gray-500"
        >
          Esta sección se publica desde el panel de administración cuando hay estadísticas cargadas.
        </div>
      )}

      {tab === 'fixture' && (
        <div className="space-y-3">
          {(upcoming.length ? upcoming : data.partidos).map((p) => (
            <div
              key={p.id}
              style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
              className="rounded-2xl px-5 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">
                    {p.local} <span className="text-[#6BFF9E]">vs</span> {p.visitante}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    J{p.jornada ?? '—'}
                    {p.hora ? ` · ${p.hora}` : ''}
                    {p.cancha ? ` · ${p.cancha}` : ''}
                  </p>
                </div>
                {p.status === 'jugado' ? (
                  <p className="text-lg font-black text-[#6BFF9E]">
                    {p.homeGoals} - {p.awayGoals}
                  </p>
                ) : (
                  <span
                    style={{ background: '#6BFF9E18', color: '#6BFF9E', border: '1px solid #6BFF9E33' }}
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-black"
                  >
                    PENDIENTE
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
