import { useCallback, useEffect, useState } from 'react';
import {
  footballApi,
  getAccessToken,
  type FootballCancha,
  type FootballJornada,
  type FootballMatch,
} from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';

export function FixturePanel() {
  const { torneoId } = useFutbolOverview();
  const [jornadas, setJornadas] = useState<FootballJornada[]>([]);
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [canchas, setCanchas] = useState<FootballCancha[]>([]);
  const [selectedJornada, setSelectedJornada] = useState('');
  const [numero, setNumero] = useState('1');
  const [fecha, setFecha] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [j, c] = await Promise.all([
        footballApi.jornadas.list(token, torneoId ?? undefined),
        footballApi.canchas(token),
      ]);
      setJornadas(j);
      setCanchas(c);
      const jId = selectedJornada || j[0]?.id || '';
      if (!selectedJornada && j[0]) setSelectedJornada(j[0].id);
      if (jId) {
        setMatches(await footballApi.matches.list(token, { jornadaId: jId }));
      } else {
        setMatches([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [torneoId, selectedJornada]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createJornada(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !torneoId || !fecha) return;
    setBusy(true);
    try {
      await footballApi.jornadas.create(
        { torneoId, numero: Number(numero), fecha },
        token,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear jornada');
    } finally {
      setBusy(false);
    }
  }

  async function generateRoundRobin() {
    const token = getAccessToken();
    if (!token || !selectedJornada) return;
    setBusy(true);
    try {
      await footballApi.jornadas.roundRobin(selectedJornada, token);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar fixture');
    } finally {
      setBusy(false);
    }
  }

  async function updateSchedule(matchId: string, canchaId: string, horaInicio: string) {
    const token = getAccessToken();
    if (!token) return;
    await footballApi.matches.updateSchedule(matchId, { canchaId, horaInicio, bloqueadoManual: true }, token);
    await reload();
  }

  return (
    <FutbolPanelShell title="Fixture">
      {error && <FutbolError message={error} />}
      <form onSubmit={createJornada} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <input
          className={futbolFieldClass()}
          type="number"
          min={1}
          placeholder="N° jornada"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
        <input
          className={futbolFieldClass()}
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <button type="submit" disabled={busy || !torneoId} className={futbolButtonClass()}>
          Crear jornada
        </button>
        <button
          type="button"
          disabled={busy || !selectedJornada}
          onClick={generateRoundRobin}
          className={futbolButtonClass('ghost')}
        >
          Generar cruces (round-robin)
        </button>
      </form>

      <select
        className="max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
        value={selectedJornada}
        onChange={(e) => setSelectedJornada(e.target.value)}
      >
        {jornadas.map((j) => (
          <option key={j.id} value={j.id}>
            Jornada {j.numero} — {new Date(j.fecha).toLocaleDateString('es-AR')}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando partidos...</p>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4">
              <p className="font-medium">
                {m.homeTeam?.name} vs {m.awayTeam?.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  defaultValue={m.canchaId ?? ''}
                  onChange={(e) =>
                    updateSchedule(m.id, e.target.value, m.horaInicio ?? '14:00')
                  }
                >
                  <option value="">Cancha</option>
                  {canchas.map((c) => (
                    <option key={c.id} value={c.id}>
                      C{c.numero} ({c.grupoCanchas?.codigo})
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  defaultValue={m.horaInicio ?? '14:00'}
                  onBlur={(e) =>
                    updateSchedule(m.id, m.canchaId ?? canchas[0]?.id ?? '', e.target.value)
                  }
                />
                <span className="text-xs text-muted-foreground self-center">{m.status}</span>
              </div>
            </div>
          ))}
          {matches.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin partidos en esta jornada.</p>
          )}
        </div>
      )}
    </FutbolPanelShell>
  );
}
