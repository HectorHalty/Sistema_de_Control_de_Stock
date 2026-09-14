import { useCallback, useEffect, useState } from 'react';
import {
  footballApi,
  getAccessToken,
  type FootballCancha,
  type FootballInscription,
  type FootballJornada,
  type FootballMatch,
} from '@/app/api/client';
import { ListPlus, UserPlus } from 'lucide-react';
import {
  FutbolError,
  FutbolPanelShell,
  FutbolSuccess,
  futbolButtonClass,
  futbolCardClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';
import { FixtureGridPreview } from './FixtureGridPreview';

export function FixturePanel() {
  const { torneoId } = useFutbolOverview();
  const [jornadas, setJornadas] = useState<FootballJornada[]>([]);
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [canchas, setCanchas] = useState<FootballCancha[]>([]);
  const [inscripciones, setInscripciones] = useState<FootballInscription[]>([]);
  const [selectedJornada, setSelectedJornada] = useState('');
  const [numero, setNumero] = useState('1');
  const [fecha, setFecha] = useState('');
  const [homeInscripcionId, setHomeInscripcionId] = useState('');
  const [awayInscripcionId, setAwayInscripcionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scheduleWarnings, setScheduleWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [j, c, i] = await Promise.all([
        footballApi.jornadas.list(token, torneoId ?? undefined),
        footballApi.canchas(token),
        torneoId
          ? footballApi.inscriptions.list(token, torneoId)
          : Promise.resolve<FootballInscription[]>([]),
      ]);
      setJornadas(j);
      setCanchas(c);
      setInscripciones(i);
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
    setSuccess(null);
    try {
      await footballApi.jornadas.create({ torneoId, numero: Number(numero), fecha }, token);
      setSuccess(`Jornada ${numero} creada.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear jornada');
    } finally {
      setBusy(false);
    }
  }

  async function createCruce(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    const jornada = jornadas.find((j) => j.id === selectedJornada);
    const home = inscripciones.find((i) => i.id === homeInscripcionId);
    const away = inscripciones.find((i) => i.id === awayInscripcionId);
    if (!token || !jornada || !home || !away || home.id === away.id) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await footballApi.matches.create(
        {
          homeTeamId: home.equipoId,
          awayTeamId: away.equipoId,
          date: jornada.fecha,
          torneoId: jornada.torneoId,
          jornadaId: jornada.id,
          homeInscripcionId: home.id,
          awayInscripcionId: away.id,
        },
        token,
      );
      setSuccess(`Cruce agregado: ${home.equipo.name} vs ${away.equipo.name}.`);
      setHomeInscripcionId('');
      setAwayInscripcionId('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el cruce');
    } finally {
      setBusy(false);
    }
  }

  async function suspendRain() {
    const token = getAccessToken();
    if (!token || !selectedJornada) return;
    if (!confirm('¿Suspender esta jornada por lluvia y mover partidos a recuperación?')) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await footballApi.jornadas.suspendRain(selectedJornada, token);
      setSuccess(
        `Jornada suspendida. Recuperación #${result.recoveryNumero} — ${result.movedMatches} partido(s) movidos.`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo suspender jornada');
    } finally {
      setBusy(false);
    }
  }

  async function publishJornada() {
    const token = getAccessToken();
    if (!token || !selectedJornada) return;
    setBusy(true);
    setSuccess(null);
    try {
      await footballApi.jornadas.publish(selectedJornada, token);
      setSuccess('Jornada publicada — visible en la web pública.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar jornada');
    } finally {
      setBusy(false);
    }
  }

  const selectedJornadaData = jornadas.find((j) => j.id === selectedJornada);

  async function updateSchedule(matchId: string, canchaId: string, horaInicio: string) {
    const token = getAccessToken();
    if (!token || !canchaId) return;
    setError(null);
    setScheduleWarnings([]);
    try {
      const result = await footballApi.matches.updateSchedule(
        matchId,
        { canchaId, horaInicio, bloqueadoManual: true },
        token,
      );
      if (result.warnings.length) setScheduleWarnings(result.warnings);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar horario');
    }
  }

  const canCreateCruce = Boolean(
    selectedJornada && homeInscripcionId && awayInscripcionId && homeInscripcionId !== awayInscripcionId,
  );

  const scheduledInscripcionIds = new Set(
    matches.flatMap((m) => [m.homeInscripcionId, m.awayInscripcionId].filter(Boolean)),
  );

  return (
    <FutbolPanelShell
      title="Fixture"
      subtitle="Creá jornadas, cargá los cruces a mano y asigná cancha/horario partido por partido"
    >

      {error && <FutbolError message={error} />}
      {success && <FutbolSuccess message={success} />}
      {scheduleWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">Avisos de historial al editar manualmente:</p>
          <ul className="mt-1 list-inside list-disc">
            {scheduleWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListPlus size={16} className="text-muted-foreground" />
          Jornadas y cruces
        </h3>

        <form onSubmit={createJornada} className="grid gap-3 md:grid-cols-4">
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
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className={futbolFieldClass('max-w-xs')}
            value={selectedJornada}
            onChange={(e) => setSelectedJornada(e.target.value)}
          >
            {jornadas.map((j) => (
              <option key={j.id} value={j.id}>
                Jornada {j.numero}
                {j.esRecuperacion ? ' (recup.)' : ''}
                {j.suspendida ? ' — SUSP.' : ''}
                {j.publicada ? ' ✓ pub.' : ''}
                — {new Date(j.fecha).toLocaleDateString('es-AR')}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selectedJornada || selectedJornadaData?.suspendida}
            onClick={() => void publishJornada()}
            className={futbolButtonClass('ghost')}
          >
            Publicar jornada
          </button>
          <button
            type="button"
            disabled={busy || !selectedJornada || selectedJornadaData?.suspendida}
            onClick={() => void suspendRain()}
            className={futbolButtonClass('ghost')}
          >
            Suspender por lluvia
          </button>
        </div>

        {selectedJornadaData?.suspendida && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Esta jornada está suspendida.
          </div>
        )}
        {selectedJornada && (
          <form onSubmit={createCruce} className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserPlus size={16} className="text-muted-foreground" />
              Agregar cruce a esta jornada
            </h4>
            {inscripciones.length < 2 ? (
              <p className="text-xs text-muted-foreground">
                Elegí un torneo con al menos 2 equipos inscriptos para poder armar cruces.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  className={futbolFieldClass()}
                  value={homeInscripcionId}
                  onChange={(e) => setHomeInscripcionId(e.target.value)}
                >
                  <option value="">Equipo local...</option>
                  {inscripciones
                    .filter((i) => i.id === homeInscripcionId || !scheduledInscripcionIds.has(i.id))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.equipo.name}
                      </option>
                    ))}
                </select>
                <select
                  className={futbolFieldClass()}
                  value={awayInscripcionId}
                  onChange={(e) => setAwayInscripcionId(e.target.value)}
                >
                  <option value="">Equipo visitante...</option>
                  {inscripciones
                    .filter((i) => i.id === awayInscripcionId || !scheduledInscripcionIds.has(i.id))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.equipo.name}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  disabled={busy || !canCreateCruce || selectedJornadaData?.suspendida}
                  className={futbolButtonClass()}
                >
                  Agregar cruce
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando partidos...</p>
      ) : (
        <>
          {matches.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Vista grilla</h3>
              <FixtureGridPreview matches={matches} canchas={canchas} />
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Partidos</h3>
            {matches.map((m) => (
              <div key={m.id} className={futbolCardClass('p-4')}>
                <p className="font-medium">
                  {m.homeTeam?.name} vs {m.awayTeam?.name}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    className={futbolFieldClass('max-w-[160px]')}
                    value={m.canchaId ?? ''}
                    onChange={(e) =>
                      void updateSchedule(m.id, e.target.value, m.horaInicio ?? '14:00')
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
                    className={futbolFieldClass('max-w-[160px]')}
                    value={m.horaInicio ?? '14:00'}
                    onChange={(e) => {
                      const canchaId = m.canchaId ?? canchas[0]?.id ?? '';
                      if (canchaId) void updateSchedule(m.id, canchaId, e.target.value);
                    }}
                  />
                  <span className="self-center text-xs text-muted-foreground">
                    {m.status}
                    {m.bloqueadoManual ? ' · manual' : ''}
                  </span>
                </div>
              </div>
            ))}
            {matches.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin partidos en esta jornada.</p>
            )}
          </div>
        </>
      )}
    </FutbolPanelShell>
  );
}
