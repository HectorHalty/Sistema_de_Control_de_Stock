import { useMemo, useState } from 'react';
import { AlertCircle, Calendar, Clock, Plus, Search, ShieldAlert, Upload, Users } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { footballMatches, footballTeams } from './data';
import { buildStandings, getUpcomingMatches } from './domain';
import type { FootballMatch, FootballTeam } from './types';

interface TournamentPlayer {
  id: string;
  fullName: string;
  teamId: string;
  number?: number;
}

interface TournamentSuspension {
  id: string;
  playerName: string;
  teamId: string;
  reason: 'Doble Amarilla' | 'Roja Directa';
  remainingMatches: number;
}

const categories = ['Hombres A', 'Hombres B', 'Hombres C', 'Mujeres A', 'Mujeres B', 'Mujeres C'] as const;

const initialPlayers: TournamentPlayer[] = [
  { id: 'p1', fullName: 'Tomás Pérez', teamId: 't1', number: 9 },
  { id: 'p2', fullName: 'Lucas Arias', teamId: 't2', number: 10 },
  { id: 'p3', fullName: 'Juan Molina', teamId: 't3', number: 8 },
  { id: 'p4', fullName: 'Nicolás Suárez', teamId: 't4', number: 1 },
  { id: 'p5', fullName: 'Camila Rojas', teamId: 't5', number: 7 },
  { id: 'p6', fullName: 'Sofía Díaz', teamId: 't6', number: 11 },
];

const initialSuspensions: TournamentSuspension[] = [
  { id: 's1', playerName: 'Lucas Arias', teamId: 't2', reason: 'Doble Amarilla', remainingMatches: 1 },
  { id: 's2', playerName: 'Camila Rojas', teamId: 't5', reason: 'Roja Directa', remainingMatches: 2 },
];

const initialRegulation = [
  'Partido ganado: 3 puntos, empate: 1 punto, derrota: 0 puntos.',
  'Máxima tolerancia de presentación: 15 minutos.',
  'Las sanciones se computan sobre partidos oficiales publicados.',
  'Todos los cambios de fixture deben publicarse desde este módulo interno.',
].join('\n');

function usePersistedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const update = (next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = next instanceof Function ? next(prev) : next;
      localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  };

  return [value, update] as const;
}

function teamName(teams: FootballTeam[], teamId: string): string {
  return teams.find(team => team.id === teamId)?.name || 'Equipo';
}

export function FutbolModule() {
  const [searchParams] = useSearchParams();
  const tabValue = searchParams.get('tab');
  const tab = (tabValue === 'partidos' || tabValue === 'equipos' || tabValue === 'jugadores' || tabValue === 'suspendidos' || tabValue === 'reglamento' || tabValue === 'avisos'
    ? tabValue
    : 'fixture') as 'fixture' | 'partidos' | 'equipos' | 'jugadores' | 'suspendidos' | 'reglamento' | 'avisos';

  const [teams, setTeams] = usePersistedState<FootballTeam[]>('futbol-teams', footballTeams);
  const [matches, setMatches] = usePersistedState<FootballMatch[]>('futbol-matches', footballMatches);
  const [players, setPlayers] = usePersistedState<TournamentPlayer[]>('futbol-players', initialPlayers);
  const [suspensions] = usePersistedState<TournamentSuspension[]>('futbol-suspensions', initialSuspensions);
  const [regulation, setRegulation] = usePersistedState<string>('futbol-reglamento', initialRegulation);
  const [notices, setNotices] = usePersistedState<string[]>('futbol-avisos', ['Fecha 3 confirmada para sábado 24/05.']);

  const [noticeInput, setNoticeInput] = useState('');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [teamCategoryInput, setTeamCategoryInput] = useState<(typeof categories)[number]>('Hombres A');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [playerTeamInput, setPlayerTeamInput] = useState(teams[0]?.id || '');
  const [searchMatch, setSearchMatch] = useState('');
  const [searchTeam, setSearchTeam] = useState('');

  const standings = useMemo(() => buildStandings(teams, matches), [teams, matches]);
  const upcoming = useMemo(() => getUpcomingMatches(matches), [matches]);

  const unpublishedCount = matches.filter(match => !match.published).length;

  const filteredMatches = matches.filter(match => {
    const h = teamName(teams, match.homeTeamId).toLowerCase();
    const a = teamName(teams, match.awayTeamId).toLowerCase();
    const search = searchMatch.toLowerCase();
    return !search || h.includes(search) || a.includes(search);
  });

  const filteredTeams = teams.filter(team => team.name.toLowerCase().includes(searchTeam.toLowerCase()));

  const publishAllPending = () => {
    setMatches(prev => prev.map(match => ({ ...match, published: true })));
  };

  const toggleSuspendedRound = (round: number) => {
    setMatches(prev => prev.map(match =>
      match.round === round
        ? { ...match, suspended: !match.suspended, published: false }
        : match,
    ));
  };

  const addTeam = () => {
    if (!teamNameInput.trim()) return;
    setTeams(prev => [...prev, { id: `t-${Date.now()}`, name: teamNameInput.trim(), category: teamCategoryInput }]);
    setTeamNameInput('');
  };

  const addPlayer = () => {
    if (!playerNameInput.trim() || !playerTeamInput) return;
    setPlayers(prev => [...prev, { id: `p-${Date.now()}`, fullName: playerNameInput.trim(), teamId: playerTeamInput }]);
    setPlayerNameInput('');
  };

  const addNotice = () => {
    if (!noticeInput.trim()) return;
    setNotices(prev => [noticeInput.trim(), ...prev]);
    setNoticeInput('');
  };

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-foreground">Módulo Fútbol Interno</h2>
        <p className="text-sm text-muted-foreground">Backoffice para editar fixture y contenido de la futura web pública del torneo.</p>
      </header>

      {tab === 'fixture' && (
        <div className="space-y-4">
          <section className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Equipos</p><p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{teams.length}</p></article>
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Partidos pendientes</p><p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{upcoming.length}</p></article>
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Sin publicar</p><p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{unpublishedCount}</p></article>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-foreground">Fixture unificado</h3>
              <button onClick={publishAllPending} className="inline-flex items-center gap-2 rounded-xl bg-[#3d7a3d] px-3 py-2 text-xs text-white hover:bg-[#2f5f2f]">
                <Upload size={14} /> Publicar cambios
              </button>
            </div>
            <div className="space-y-2">
              {matches.map(match => (
                <article key={match.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-foreground">Fecha {match.round} · {teamName(teams, match.homeTeamId)} vs {teamName(teams, match.awayTeamId)}</p>
                    <div className="flex items-center gap-2">
                      {!match.published && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Sin publicar</span>}
                      {match.suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">Suspendida</span>}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar size={12} /> {new Date(match.dateISO).toLocaleDateString('es-AR')}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {new Date(match.dateISO).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{match.field || 'Cancha sin definir'}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...new Set(matches.map(match => match.round))].map(round => (
                <button key={round} onClick={() => toggleSuspendedRound(round)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">
                  Suspender/Reactivar Fecha {round}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'partidos' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <h3 className="text-foreground">Partidos</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input value={searchMatch} onChange={event => setSearchMatch(event.target.value)} placeholder="Buscar equipos..." className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 outline-none focus:border-[#3d7a3d]" />
          </div>
          <div className="space-y-2">
            {filteredMatches.map(match => (
              <article key={match.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{teamName(teams, match.homeTeamId)} vs {teamName(teams, match.awayTeamId)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${match.status === 'jugado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{match.status}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'equipos' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <h3 className="text-foreground">Equipos</h3>
          <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <input value={teamNameInput} onChange={event => setTeamNameInput(event.target.value)} placeholder="Nombre de equipo" className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#3d7a3d]" />
            <select value={teamCategoryInput} onChange={event => setTeamCategoryInput(event.target.value as (typeof categories)[number])} className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#3d7a3d]">
              {categories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
            <button onClick={addTeam} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3d7a3d] px-3 py-2 text-sm text-white hover:bg-[#2f5f2f]"><Plus size={14} /> Agregar</button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input value={searchTeam} onChange={event => setSearchTeam(event.target.value)} placeholder="Buscar equipo..." className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 outline-none focus:border-[#3d7a3d]" />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {filteredTeams.map(team => (
              <article key={team.id} className="rounded-xl border border-border bg-background p-3">
                <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{team.name}</p>
                <p className="text-xs text-muted-foreground">{team.category}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'jugadores' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <h3 className="text-foreground">Jugadores</h3>
          <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <input value={playerNameInput} onChange={event => setPlayerNameInput(event.target.value)} placeholder="Nombre completo" className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#3d7a3d]" />
            <select value={playerTeamInput} onChange={event => setPlayerTeamInput(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#3d7a3d]">
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <button onClick={addPlayer} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3d7a3d] px-3 py-2 text-sm text-white hover:bg-[#2f5f2f]"><Plus size={14} /> Agregar</button>
          </div>
          <div className="space-y-2">
            {players.map(player => (
              <article key={player.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-foreground">{player.fullName}</p>
                  <span className="rounded-full bg-[#3d7a3d]/10 px-2 py-0.5 text-xs text-[#2f5f2f] dark:bg-[#3d7a3d]/20 dark:text-emerald-300">{teamName(teams, player.teamId)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'suspendidos' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
          <div className="mb-1 flex items-center gap-2"><ShieldAlert size={18} className="text-amber-600 dark:text-amber-300" /><h3 className="text-foreground">Suspendidos</h3></div>
          {suspensions.map(item => (
            <article key={item.id} className="rounded-xl border border-border bg-background p-3">
              <p className="text-sm text-foreground">{item.playerName} · {teamName(teams, item.teamId)}</p>
              <p className="text-xs text-muted-foreground">{item.reason}</p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Restan {item.remainingMatches} partido(s)</p>
            </article>
          ))}
        </section>
      )}

      {tab === 'reglamento' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
          <h3 className="text-foreground">Reglamento</h3>
          <textarea value={regulation} onChange={event => setRegulation(event.target.value)} rows={8} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#3d7a3d]" />
          <p className="text-xs text-muted-foreground">Este contenido es interno y se usará para publicar en la futura web de clientes.</p>
        </section>
      )}

      {tab === 'avisos' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <h3 className="text-foreground">Avisos</h3>
          <div className="flex gap-2">
            <input value={noticeInput} onChange={event => setNoticeInput(event.target.value)} placeholder="Escribí un aviso..." className="flex-1 rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#3d7a3d]" />
            <button onClick={addNotice} className="rounded-xl bg-[#3d7a3d] px-3 py-2 text-sm text-white hover:bg-[#2f5f2f]">Agregar</button>
          </div>
          <div className="space-y-2">
            {notices.map(notice => (
              <article key={notice} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 text-[#2d5fa8]" /><p className="text-sm text-foreground">{notice}</p></div>
              </article>
            ))}
          </div>
          <section className="overflow-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-muted-foreground"><th className="px-3 py-2">Equipo</th><th className="px-3 py-2">Pts</th><th className="px-3 py-2">GF</th><th className="px-3 py-2">GC</th></tr>
              </thead>
              <tbody>
                {standings.map(row => (
                  <tr key={row.teamId} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{teamName(teams, row.teamId)}</td>
                    <td className="px-3 py-2">{row.points}</td>
                    <td className="px-3 py-2">{row.goalsFor}</td>
                    <td className="px-3 py-2">{row.goalsAgainst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      )}
    </div>
  );
}
