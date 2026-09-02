import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { PageLoader } from '../../ui/PageLoader';
import { DEMO_TOP_SCORERS } from '../demo-torneo';
import { mapStandingsFromApi, resolveRecentResults, resolveStandings } from '../torneo-mappers';

type Tab = 'posiciones' | 'goleadores' | 'tarjetas' | 'suspendidos' | 'fixture';

function difLabel(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function formatFixtureDate(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

function cardColor(tipo: string) {
  switch (tipo) {
    case 'roja':
    case 'expulsion_directa':
      return '#ef4444';
    case 'doble_amarilla':
      return '#f97316';
    case 'azul':
      return '#3b82f6';
    default:
      return '#eab308';
  }
}

export function TorneoPage() {
  const [tab, setTab] = useState<Tab>('posiciones');
  const [categoriaCodigo, setCategoriaCodigo] = useState<string>('');
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [seasonKey, setSeasonKey] = useState<string>('');
  const { meContext } = usePublicAuth();
  const myTeam = meContext?.equipo?.name;
  const myCategoria = meContext?.equipo?.categoria;

  const { data: torneosList = [] } = useQuery({
    queryKey: ['public-torneos'],
    queryFn: () => publicApi.torneos(),
    retry: false,
  });

  const seasons = [...new Set(torneosList.map((t) => `${t.campeonato} · ${t.temporada}`))];
  const activeSeason = seasonKey || seasons[0] || '';
  const torneosInSeason = torneosList.filter(
    (t) => `${t.campeonato} · ${t.temporada}` === activeSeason,
  );
  const selectedCodigo =
    categoriaCodigo ||
    torneosInSeason.find((t) => t.categoria === myCategoria)?.categoriaCodigo ||
    torneosInSeason[0]?.categoriaCodigo ||
    torneosList[0]?.categoriaCodigo ||
    '';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-torneo', selectedCodigo],
    queryFn: () => publicApi.torneo(undefined, selectedCodigo || undefined),
    enabled: !!selectedCodigo || torneosList.length === 0,
    retry: false,
  });

  if (isLoading && !data) return <PageLoader />;

  const isDemo = !data?.torneo || isError;
  const torneo = data?.torneo;
  const displayStandings = isDemo
    ? resolveStandings(undefined, true)
    : data?.standings?.length
      ? mapStandingsFromApi(data.standings)
      : resolveStandings(undefined, true);

  const partidos = data?.partidos ?? [];
  const fixtureByJornada = partidos.reduce<Map<number | null, typeof partidos>>((acc, p) => {
    const key = p.jornada;
    const list = acc.get(key) ?? [];
    list.push(p);
    acc.set(key, list);
    return acc;
  }, new Map());

  const jornadas = [...fixtureByJornada.keys()].sort((a, b) => (a ?? 0) - (b ?? 0));

  const goleadores =
    !isDemo && data?.goleadores?.length
      ? data.goleadores
      : isDemo
        ? DEMO_TOP_SCORERS.map((r) => ({
            rank: r.rank,
            player: r.player,
            team: r.team,
            goals: r.goals,
          }))
        : [];

  const suspensiones = !isDemo ? (data?.suspensiones ?? []) : [];
  const tarjetas = !isDemo ? (data?.tarjetas ?? []) : [];
  const recent = resolveRecentResults(isDemo ? null : data, isDemo);
  const isMyCategoria = Boolean(myCategoria && (torneo?.categoria ?? 'Libre A') === myCategoria);

  return (
    <div className="mx-auto p-6" style={{ maxWidth: '56rem' }}>
      <div className="relative mb-5">
        <h1 className="mb-1 text-2xl font-black text-white">Torneo La Chacra</h1>
        <button
          type="button"
          onClick={() => setSeasonOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#6BFF9E]"
        >
          {torneo ? `${torneo.campeonato} ${torneo.temporada}` : activeSeason || 'Apertura · Temporada demo'}
          <span className="text-[10px]">{seasonOpen ? '▴' : '▾'}</span>
        </button>
        {seasonOpen && seasons.length > 0 && (
          <div
            style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
            className="absolute z-20 mt-2 w-64 overflow-hidden rounded-xl"
          >
            {seasons.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSeasonKey(s);
                  setCategoriaCodigo('');
                  setSeasonOpen(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[#242424]"
                style={{ color: s === activeSeason ? '#6BFF9E' : 'white' }}
              >
                {s}
                {s === activeSeason ? <span>✓</span> : null}
              </button>
            ))}
          </div>
        )}
        {isDemo && !torneosList.length && (
          <p className="mt-2 text-xs text-gray-600">
            Datos de demostración — se actualizarán cuando el torneo esté publicado en el admin.
          </p>
        )}
      </div>

      <div
        style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14 }}
        className="mb-5"
      >
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div style={{ width: 3, height: 18, background: '#6BFF9E', borderRadius: 2 }} />
            <span className="text-sm font-black text-white">
              {torneo?.categoria ?? 'Libre A'}
            </span>
            {isMyCategoria && (
              <span
                style={{ background: '#6BFF9E', color: '#0e0e0e' }}
                className="rounded-full px-2 py-0.5 text-[9px] font-black"
              >
                MI CATEGORÍA
              </span>
            )}
            {isDemo && (
              <span
                style={{ background: '#6BFF9E22', color: '#6BFF9E', border: '1px solid #6BFF9E44' }}
                className="rounded-full px-1.5 py-0.5 text-[9px] font-black"
              >
                DEMO
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCatOpen((v) => !v)}
            className="text-xs font-bold text-gray-400 hover:text-white"
          >
            Cambiar categoría {catOpen ? '▴' : '▾'}
          </button>
        </div>
        {catOpen && (torneosInSeason.length || torneosList.length) > 0 && (
          <div className="grid grid-cols-2 gap-2 border-t border-[#2a2a2a] px-5 py-4">
            {(torneosInSeason.length ? torneosInSeason : torneosList).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setCategoriaCodigo(t.categoriaCodigo);
                  setCatOpen(false);
                }}
                style={
                  selectedCodigo === t.categoriaCodigo
                    ? { background: t.categoriaColor ?? '#6BFF9E', color: '#0e0e0e' }
                    : { background: '#161616', color: '#9ca3af', border: '1px solid #2a2a2a' }
                }
                className="rounded-lg px-3 py-2 text-xs font-bold"
              >
                {t.categoria}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ['posiciones', 'Posiciones'],
            ['goleadores', 'Goleadores'],
            ['tarjetas', 'Tarjetas'],
            ['suspendidos', 'Suspendidos'],
            ['fixture', 'Fixture'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={
              tab === id
                ? { background: 'transparent', color: '#6BFF9E', border: '1px solid #6BFF9E' }
                : { background: '#1c1c1c', color: '#9ca3af', border: '1px solid #2a2a2a' }
            }
            className="rounded-full px-4 py-1.5 text-sm font-bold"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'posiciones' && (
        <div className="space-y-5">
          {!!recent.length && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-white">Últimos Resultados</p>
                {myTeam && (
                  <span
                    style={{ background: '#6BFF9E22', color: '#6BFF9E', border: '1px solid #6BFF9E44' }}
                    className="rounded-full px-3 py-1 text-[10px] font-black"
                  >
                    {myTeam}
                  </span>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recent.slice(0, 4).map((r) => {
                  const myInvolved = myTeam && (r.local === myTeam || r.visitante === myTeam);
                  const myScore = myInvolved
                    ? r.local === myTeam
                      ? r.homeGoals
                      : r.awayGoals
                    : r.homeGoals;
                  const oppScore = myInvolved
                    ? r.local === myTeam
                      ? r.awayGoals
                      : r.homeGoals
                    : r.awayGoals;
                  const won = (myScore ?? 0) > (oppScore ?? 0);
                  const drew = myScore === oppScore;
                  const badge = won ? 'V' : drew ? 'E' : 'D';
                  const badgeColor = won ? '#6BFF9E' : drew ? '#f97316' : '#ef4444';
                  return (
                    <div
                      key={r.id}
                      style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', minWidth: 210 }}
                      className="relative shrink-0 rounded-xl px-4 py-3"
                    >
                      <p className="text-[10px] text-gray-500">
                        {r.date}
                        {r.cancha ? ` · ${r.cancha}` : ''}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-black text-white">
                          {r.local.slice(0, 3).toUpperCase()}
                        </span>
                        <span className="text-lg font-black text-white">
                          {r.homeGoals} - {r.awayGoals}
                        </span>
                        <span className="text-xs font-black text-gray-400">
                          {r.visitante.slice(0, 3).toUpperCase()}
                        </span>
                      </div>
                      {myInvolved && (
                        <span
                          style={{ background: badgeColor, color: '#0e0e0e' }}
                          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black"
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="overflow-hidden rounded-xl">
            <div className="border-b border-[#2a2a2a] px-5 py-3">
              <p className="text-sm font-bold text-white">
                Tabla de Posiciones — {torneo?.categoria ?? 'Libre A'}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 text-left">POS</th>
                  <th className="px-4 py-3 text-left">Equipo</th>
                  <th className="px-2 py-3 text-center">PJ</th>
                  <th className="px-2 py-3 text-center">PG</th>
                  <th className="px-2 py-3 text-center">PE</th>
                  <th className="px-2 py-3 text-center">PP</th>
                  <th className="px-2 py-3 text-center">Pts</th>
                  <th className="px-4 py-3 text-center">DIF</th>
                </tr>
              </thead>
              <tbody>
                {displayStandings.map((row) => {
                  const highlight = myTeam === row.team;
                  const dg = row.gf - row.gc;
                  return (
                    <tr
                      key={`${row.abbr}-${row.pos}`}
                      style={highlight ? { background: '#6BFF9E0a' } : undefined}
                      className="border-b border-[#242424] last:border-0"
                    >
                      <td
                        className="px-4 py-3 font-black"
                        style={{ color: highlight ? '#6BFF9E' : '#6b7280' }}
                      >
                        {row.pos}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: highlight ? '#6BFF9E' : 'white' }}>
                        <span className="inline-flex items-center gap-2">
                          {row.team}
                          {highlight && (
                            <span
                              style={{ background: '#6BFF9E', color: '#0e0e0e' }}
                              className="rounded px-1.5 py-px text-[9px] font-black"
                            >
                              TÚ
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center text-gray-400">{row.pj}</td>
                      <td className="px-2 py-3 text-center text-gray-400">{row.pg}</td>
                      <td className="px-2 py-3 text-center text-gray-400">{row.pe}</td>
                      <td className="px-2 py-3 text-center text-gray-400">{row.pp}</td>
                      <td className="px-2 py-3 text-center font-black text-[#6BFF9E]">{row.pts}</td>
                      <td
                        className="px-4 py-3 text-center font-bold"
                        style={{ color: dg > 0 ? '#6BFF9E' : dg < 0 ? '#ef4444' : '#9ca3af' }}
                      >
                        {difLabel(dg)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'goleadores' && (
        <div>
          {isDemo && (
            <p className="mb-3 text-xs text-gray-600">
              Datos de demostración — se actualizarán con los goles cargados en resultados.
            </p>
          )}
          <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Jugador</th>
                  <th className="px-4 py-3 text-left">Equipo</th>
                  <th className="px-4 py-3 text-center">Goles</th>
                </tr>
              </thead>
              <tbody>
                {goleadores.map((row) => (
                  <tr key={row.rank} className="border-b border-[#242424] last:border-0">
                    <td className="px-4 py-3 font-black text-gray-500">{row.rank}</td>
                    <td className="px-4 py-3 font-semibold text-white">{row.player}</td>
                    <td className="px-4 py-3 text-gray-400">{row.team}</td>
                    <td className="px-4 py-3 text-center font-black text-[#6BFF9E]">{row.goals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isDemo && !goleadores.length && (
              <p className="px-5 py-6 text-center text-sm text-gray-500">
                Todavía no hay goles registrados en este torneo.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'tarjetas' && (
        <div>
          <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-3">
              <p className="text-xs font-black uppercase tracking-widest text-[#6BFF9E]">
                Tarjetas del torneo
              </p>
              <span className="text-xs text-gray-500">{tarjetas.length} registradas</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 text-left">Jugador</th>
                  <th className="px-4 py-3 text-left">Equipo</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Partido</th>
                  <th className="px-4 py-3 text-center">Min</th>
                </tr>
              </thead>
              <tbody>
                {tarjetas.map((row) => (
                  <tr key={row.id} className="border-b border-[#242424] last:border-0">
                    <td className="px-4 py-3 font-semibold text-white">{row.jugador}</td>
                    <td className="px-4 py-3 text-gray-400">{row.equipo}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold"
                        style={{
                          background: `${cardColor(row.tipo)}22`,
                          color: cardColor(row.tipo),
                          border: `1px solid ${cardColor(row.tipo)}44`,
                        }}
                      >
                        {row.tipoLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {row.jornada != null ? `J${row.jornada} · ` : ''}
                      {row.partido}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">
                      {row.minuto != null ? `${row.minuto}'` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isDemo && !tarjetas.length && (
              <p className="px-5 py-6 text-center text-sm text-gray-500">
                Sin tarjetas registradas en esta categoría.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'suspendidos' && (
        <div>
          <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-3">
              <p className="text-xs font-black uppercase tracking-widest text-[#6BFF9E]">
                Jugadores suspendidos
              </p>
              <span className="text-xs text-gray-500">{suspensiones.length} activos</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 text-left">Jugador</th>
                  <th className="px-4 py-3 text-left">Equipo</th>
                  <th className="px-4 py-3 text-left">Motivo</th>
                  <th className="px-4 py-3 text-center">Fechas</th>
                </tr>
              </thead>
              <tbody>
                {suspensiones.map((row) => (
                  <tr key={row.id} className="border-b border-[#242424] last:border-0">
                    <td className="px-4 py-3 font-semibold text-white">{row.jugador}</td>
                    <td className="px-4 py-3 text-gray-400">{row.equipo}</td>
                    <td className="px-4 py-3 text-gray-400">{row.motivo}</td>
                    <td className="px-4 py-3 text-center font-black text-[#6BFF9E]">
                      {row.fechasRestantes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isDemo && !suspensiones.length && (
              <p className="px-5 py-6 text-center text-sm text-gray-500">
                No hay jugadores suspendidos en esta categoría.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'fixture' && (
        <div className="space-y-4">
          {!partidos.length ? (
            <div
              style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
              className="rounded-xl p-8 text-center text-gray-500"
            >
              {isDemo
                ? 'El fixture se habilitará cuando el torneo esté generado y publicado en el admin.'
                : 'Todavía no hay partidos cargados para este torneo.'}
            </div>
          ) : (
            jornadas.map((jornada) => (
              <div
                key={jornada ?? 'sin-jornada'}
                style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
                className="overflow-hidden rounded-xl"
              >
                <div className="border-b border-[#2a2a2a] px-5 py-3">
                  <p className="text-xs font-black uppercase tracking-widest text-[#6BFF9E]">
                    {jornada != null ? `Jornada ${jornada}` : 'Partidos'}
                  </p>
                </div>
                <div className="divide-y divide-[#242424]">
                  {(fixtureByJornada.get(jornada) ?? []).map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <div className="w-24 shrink-0 text-[10px] font-semibold uppercase text-gray-500">
                        {formatFixtureDate(p.fecha)}
                        {p.hora ? ` · ${p.hora}` : ''}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">
                          {p.local}{' '}
                          <span className="text-gray-600">vs</span> {p.visitante}
                        </p>
                        {p.cancha && (
                          <p className="text-[10px] text-gray-600">{p.cancha}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {p.status === 'jugado' && p.homeGoals != null && p.awayGoals != null ? (
                          <span className="text-sm font-black text-[#6BFF9E]">
                            {p.homeGoals} - {p.awayGoals}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase text-gray-500">
                            {p.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
