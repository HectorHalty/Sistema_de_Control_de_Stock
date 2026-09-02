import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import {
  footballApi,
  getAccessToken,
  type FootballInscription,
  type FootballMatch,
  type FootballMatchEvent,
  type FootballRosterPlayer,
} from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';

const EVENT_TYPES = [
  { value: 'gol', label: 'Gol' },
  { value: 'asistencia', label: 'Asistencia' },
  { value: 'amarilla', label: 'Amarilla' },
  { value: 'roja', label: 'Roja' },
  { value: 'doble_amarilla', label: 'Doble amarilla' },
  { value: 'expulsion_directa', label: 'Expulsión directa' },
] as const;

function eventLabel(tipo: string) {
  return EVENT_TYPES.find((t) => t.value === tipo)?.label ?? tipo;
}

function MatchEventsSection({
  match,
  inscripcionByTeam,
  onChanged,
}: {
  match: FootballMatch;
  inscripcionByTeam: Map<string, string>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<FootballMatchEvent[]>(match.eventos ?? []);
  const [players, setPlayers] = useState<FootballRosterPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [personaId, setPersonaId] = useState('');
  const [tipo, setTipo] = useState('gol');
  const [minuto, setMinuto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPlayers = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const homeIns =
      match.homeInscripcionId ?? inscripcionByTeam.get(match.homeTeamId);
    const awayIns =
      match.awayInscripcionId ?? inscripcionByTeam.get(match.awayTeamId);
    if (!homeIns && !awayIns) {
      setPlayers([]);
      return;
    }
    setLoadingPlayers(true);
    try {
      const lists = await Promise.all(
        [homeIns, awayIns]
          .filter(Boolean)
          .map((id) => footballApi.roster.get(id!, token)),
      );
      setPlayers(lists.flatMap((r) => r.jugadores));
    } catch {
      setPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  }, [match, inscripcionByTeam]);

  useEffect(() => {
    setEvents(match.eventos ?? []);
  }, [match.eventos, match.id]);

  useEffect(() => {
    if (open) void loadPlayers();
  }, [open, loadPlayers]);

  async function refreshEvents() {
    const token = getAccessToken();
    if (!token) return;
    const rows = await footballApi.matches.listEvents(match.id, token);
    setEvents(rows);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !personaId) return;
    setSaving(true);
    setError(null);
    try {
      await footballApi.matches.addEvent(
        match.id,
        {
          personaId,
          tipo,
          minuto: minuto ? Number(minuto) : undefined,
        },
        token,
      );
      setPersonaId('');
      setMinuto('');
      await refreshEvents();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar evento');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(eventId: string) {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await footballApi.matches.deleteEvent(eventId, token);
      await refreshEvents();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full border-t border-border pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        Eventos ({events.length})
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {events.length > 0 ? (
            <ul className="space-y-1.5">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">
                      {ev.persona
                        ? `${ev.persona.apellido}, ${ev.persona.nombre}`
                        : ev.personaId}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {eventLabel(ev.tipo)}
                      {ev.minuto != null ? ` (${ev.minuto}')` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDelete(ev.id)}
                    className="rounded p-1 text-red-500 hover:bg-red-500/10"
                    aria-label="Eliminar evento"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Sin eventos registrados.</p>
          )}

          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <select
              className={`${futbolFieldClass()} min-w-[200px] flex-1`}
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              required
              disabled={loadingPlayers || saving}
            >
              <option value="">
                {loadingPlayers ? 'Cargando planteles...' : 'Jugador'}
              </option>
              {players.map((p) => (
                <option key={p.personaId} value={p.personaId}>
                  {p.apellido}, {p.nombre}
                  {p.numeroCamiseta != null ? ` #${p.numeroCamiseta}` : ''}
                </option>
              ))}
            </select>
            <select
              className={`${futbolFieldClass()} w-36`}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={saving}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              className={`${futbolFieldClass()} w-20`}
              placeholder="Min"
              inputMode="numeric"
              value={minuto}
              onChange={(e) => setMinuto(e.target.value.replace(/\D/g, ''))}
              disabled={saving}
            />
            <button type="submit" disabled={saving || !personaId} className={futbolButtonClass()}>
              Agregar
            </button>
          </form>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function ResultadosPanel() {
  const { torneoId } = useFutbolOverview();
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [inscripcionByTeam, setInscripcionByTeam] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, inscriptions] = await Promise.all([
        footballApi.matches.list(token, { torneoId: torneoId ?? undefined }),
        footballApi.inscriptions.list(token, torneoId ?? undefined),
      ]);
      setMatches(rows);
      const teamMap = new Map<string, string>();
      inscriptions.forEach((i: FootballInscription) => teamMap.set(i.equipoId, i.id));
      setInscripcionByTeam(teamMap);

      const map: Record<string, { home: string; away: string }> = {};
      rows.forEach((m) => {
        map[m.id] = {
          home: String(m.homeGoals ?? 0),
          away: String(m.awayGoals ?? 0),
        };
      });
      setScores(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [torneoId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveScore(matchId: string) {
    const token = getAccessToken();
    const s = scores[matchId];
    if (!token || !s) return;
    try {
      await footballApi.matches.updateScore(
        matchId,
        Number(s.home) || 0,
        Number(s.away) || 0,
        token,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  return (
    <FutbolPanelShell title="Resultados">
      <p className="text-sm text-muted-foreground">
        Cargá marcadores y eventos (goles, tarjetas). Los goles actualizan el marcador automáticamente
        y alimentan goleadores y suspendidos en la web pública.
      </p>
      {error && <FutbolError message={error} />}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando partidos...</p>
      ) : !matches.length ? (
        <p className="text-sm text-muted-foreground">No hay partidos en este torneo.</p>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[160px] flex-1 font-medium">{m.homeTeam?.name}</div>
                <input
                  className={`${futbolFieldClass()} w-16 text-center`}
                  value={scores[m.id]?.home ?? '0'}
                  onChange={(e) =>
                    setScores((prev) => ({
                      ...prev,
                      [m.id]: {
                        ...prev[m.id],
                        home: e.target.value,
                        away: prev[m.id]?.away ?? '0',
                      },
                    }))
                  }
                />
                <span className="text-muted-foreground">—</span>
                <input
                  className={`${futbolFieldClass()} w-16 text-center`}
                  value={scores[m.id]?.away ?? '0'}
                  onChange={(e) =>
                    setScores((prev) => ({
                      ...prev,
                      [m.id]: { home: prev[m.id]?.home ?? '0', away: e.target.value },
                    }))
                  }
                />
                <div className="min-w-[160px] flex-1 text-right font-medium">{m.awayTeam?.name}</div>
                <button
                  type="button"
                  className={futbolButtonClass()}
                  onClick={() => void saveScore(m.id)}
                >
                  Guardar resultado
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(m.date).toLocaleDateString('es-AR')}
                {m.horaInicio ? ` · ${m.horaInicio}` : ''}
                {m.cancha ? ` · Cancha ${m.cancha.numero}` : m.venue ? ` · ${m.venue}` : ''}
                {' · '}
                <span className={m.status === 'jugado' ? 'text-primary' : ''}>{m.status}</span>
              </p>
              <MatchEventsSection
                match={m}
                inscripcionByTeam={inscripcionByTeam}
                onChanged={() => void reload()}
              />
            </div>
          ))}
        </div>
      )}
    </FutbolPanelShell>
  );
}
