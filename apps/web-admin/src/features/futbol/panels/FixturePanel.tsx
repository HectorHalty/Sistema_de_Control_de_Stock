import { useCallback, useEffect, useState } from 'react';
import {
  footballApi,
  getAccessToken,
  type FootballCancha,
  type FootballJornada,
  type FootballJornadaPreferencias,
  type FootballMatch,
} from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';
import { FixtureGridPreview } from './FixtureGridPreview';
import { SaturdayGridPreview } from './SaturdayGridPreview';
import type { SaturdayGridResponse } from '@/app/api/client';

function FutbolSuccess({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
      {message}
    </div>
  );
}

function SaturdayMultiCatSection() {
  const [fecha, setFecha] = useState('');
  const [grid, setGrid] = useState<SaturdayGridResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadGrid() {
    const token = getAccessToken();
    if (!token || !fecha) return;
    setErr(null);
    try {
      setGrid(await footballApi.scheduling.saturdayGrid(token, fecha));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    }
  }

  async function autoSaturday() {
    const token = getAccessToken();
    if (!token || !fecha) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await footballApi.scheduling.autoSaturday(token, { fecha });
      setMsg(
        `Programados ${r.scheduled} partido(s) multi-categoría.` +
          (r.warnings.length ? ` Avisos: ${r.warnings.slice(0, 3).join('; ')}` : ''),
      );
      await loadGrid();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function publishAll() {
    const token = getAccessToken();
    if (!token || !fecha) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await footballApi.scheduling.publishFecha(token, { fecha });
      setMsg(`Publicadas ${r.publicadas} jornada(s) en todas las categorías.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <h3 className="text-sm font-semibold">Programación sábado (multi-categoría)</h3>
      <p className="text-xs text-muted-foreground">
        Auto-programa todas las categorías del campeonato activo compartiendo canchas 1–8. Creá
        jornadas con la misma fecha en cada categoría antes de usar esto.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="date"
          className={futbolFieldClass('max-w-[180px]')}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <button type="button" className={futbolButtonClass()} disabled={!fecha || busy} onClick={() => void autoSaturday()}>
          Auto-programar sábado
        </button>
        <button type="button" className={futbolButtonClass('ghost')} disabled={!fecha || busy} onClick={() => void loadGrid()}>
          Ver grilla global
        </button>
        <button type="button" className={futbolButtonClass('ghost')} disabled={!fecha || busy} onClick={() => void publishAll()}>
          Publicar todas las jornadas
        </button>
      </div>
      {msg && <FutbolSuccess message={msg} />}
      {err && <FutbolError message={err} />}
      {grid && <SaturdayGridPreview data={grid} />}
    </div>
  );
}

function PreferenciasHorarioSection({
  jornadaId,
  disabled,
}: {
  jornadaId: string;
  disabled?: boolean;
}) {
  const [data, setData] = useState<FootballJornadaPreferencias | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !jornadaId) return;
    setLoading(true);
    try {
      setData(await footballApi.jornadas.preferencias.get(jornadaId, token));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [jornadaId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(inscripcionId: string, horaPreferida: string | null) {
    const token = getAccessToken();
    if (!token) return;
    setSavingId(inscripcionId);
    try {
      await footballApi.jornadas.preferencias.upsert(jornadaId, inscripcionId, horaPreferida, token);
      await reload();
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando preferencias...</p>;
  }

  if (!data?.equipos.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Inscribí equipos en el torneo para cargar preferencias de horario.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-3">Equipo</th>
            <th className="px-4 py-3">Horario preferido</th>
          </tr>
        </thead>
        <tbody>
          {data.equipos.map((eq) => (
            <tr key={eq.inscripcionId} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{eq.name}</td>
              <td className="px-4 py-3">
                <select
                  className={futbolFieldClass('max-w-[140px]')}
                  value={eq.horaPreferida ?? ''}
                  disabled={disabled || savingId === eq.inscripcionId}
                  onChange={(e) =>
                    void save(eq.inscripcionId, e.target.value || null)
                  }
                >
                  <option value="">Sin preferencia</option>
                  {data.franjas.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const [success, setSuccess] = useState<string | null>(null);
  const [scheduleWarnings, setScheduleWarnings] = useState<string[]>([]);
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

  async function generateRoundRobin() {
    const token = getAccessToken();
    if (!token || !selectedJornada) return;
    setBusy(true);
    setSuccess(null);
    try {
      const result = await footballApi.jornadas.roundRobin(selectedJornada, token);
      setSuccess(`Generados ${result.created} cruces.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar fixture');
    } finally {
      setBusy(false);
    }
  }

  async function autoSchedule() {
    const token = getAccessToken();
    if (!token || !selectedJornada) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await footballApi.jornadas.autoSchedule(selectedJornada, token);
      let msg = `Programados ${result.scheduled} partido(s).`;
      if (result.skippedManual) msg += ` ${result.skippedManual} respetados (manual).`;
      if (result.warnings.length) msg += ` Avisos: ${result.warnings.join('; ')}`;
      setSuccess(msg);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo auto-programar');
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

  return (
    <FutbolPanelShell title="Fixture">
      <p className="text-sm text-muted-foreground">
        Creá jornadas, cargá preferencias de horario por equipo, generá cruces, auto-programá
        canchas/horarios y publicá en la web.
      </p>

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

      <SaturdayMultiCatSection />

      <form
        onSubmit={createJornada}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4"
      >
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
          onClick={() => void generateRoundRobin()}
          className={futbolButtonClass('ghost')}
        >
          Generar cruces (round-robin)
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
          onClick={() => void autoSchedule()}
          className={futbolButtonClass()}
        >
          Auto-programar canchas
        </button>
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
        <p className="text-sm text-amber-600">Esta jornada está suspendida.</p>
      )}

      {selectedJornada && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Preferencias de horario (jornada)</h3>
          <p className="text-xs text-muted-foreground">
            El auto-programador intenta respetar estos horarios. Si no hay slot, muestra un aviso.
          </p>
          <PreferenciasHorarioSection
            jornadaId={selectedJornada}
            disabled={selectedJornadaData?.suspendida}
          />
        </div>
      )}

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
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-medium">
                  {m.homeTeam?.name} vs {m.awayTeam?.name}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
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
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
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
