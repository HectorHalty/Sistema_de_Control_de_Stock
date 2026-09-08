import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  footballApi,
  getAccessToken,
  type FootballCancha,
  type FootballMatch,
  type FootballTorneo,
  type SaturdayGridResponse,
} from '@/app/api/client';
import { Ban } from 'lucide-react';
import {
  FutbolError,
  FutbolPanelShell,
  FutbolSuccess,
  futbolButtonClass,
  futbolCardClass,
  futbolFieldClass,
} from '../futbol-shared';

/** Franjas horarias por defecto para poder abrir celdas vacías aunque todavía no haya nada asignado ese día. */
const DEFAULT_FRANJAS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

type GenderGridProps = {
  titulo: string;
  genero: 'hombres' | 'mujeres';
  partidos: SaturdayGridResponse['partidos'];
  canchas: FootballCancha[];
  pendientes: FootballMatch[];
  onAssign: (matchId: string, canchaId: string, hora: string) => Promise<void>;
  onSuspendMatch: (matchId: string) => Promise<void>;
  busy: boolean;
};

function GenderGrid({
  titulo,
  partidos,
  canchas,
  pendientes,
  onAssign,
  onSuspendMatch,
  busy,
}: GenderGridProps) {
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [pickedMatch, setPickedMatch] = useState('');

  const cols = [...canchas].sort((a, b) => a.numero - b.numero);
  const scheduledHoras = [...new Set(partidos.filter((p) => p.hora).map((p) => p.hora as string))];
  const horas = [...new Set([...DEFAULT_FRANJAS, ...scheduledHoras])].sort();

  const cellMap = new Map<string, SaturdayGridResponse['partidos'][number]>();
  for (const p of partidos) {
    if (p.canchaId && p.hora) cellMap.set(`${p.canchaId}|${p.hora}`, p);
  }

  if (!cols.length) {
    return <p className="text-sm text-muted-foreground">No hay canchas configuradas.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {titulo} · Hora
            </th>
            {cols.map((c) => (
              <th
                key={c.id}
                className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                C{c.numero}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horas.map((hora) => (
            <tr key={hora} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold">{hora}</td>
              {cols.map((c) => {
                const key = `${c.id}|${hora}`;
                const match = cellMap.get(key) ?? null;
                const isOpen = openCell === key;
                return (
                  <td key={c.id} className="p-2 align-top">
                    {match ? (
                      <div
                        className="space-y-1.5 rounded-lg border p-2 text-center text-xs font-medium"
                        style={{
                          borderColor: `${match.categoriaColor ?? '#3d7a3d'}66`,
                          background: `${match.categoriaColor ?? '#3d7a3d'}18`,
                        }}
                        title={`${match.local} vs ${match.visitante}`}
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wide opacity-80">
                          {match.categoria}
                        </span>
                        <span className="block leading-tight">
                          {match.local.slice(0, 10)} vs {match.visitante.slice(0, 10)}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-500/40 py-1 text-[11px] text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
                          onClick={() => void onSuspendMatch(match.id)}
                        >
                          <Ban size={12} />
                          Suspender
                        </button>
                      </div>
                    ) : isOpen ? (
                      <div className="space-y-1.5">
                        <select
                          className={futbolFieldClass('px-2 py-1 text-xs')}
                          value={pickedMatch}
                          onChange={(e) => setPickedMatch(e.target.value)}
                        >
                          <option value="">Elegir partido...</option>
                          {pendientes.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.homeTeam?.name ?? '?'} vs {m.awayTeam?.name ?? '?'}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={!pickedMatch || busy}
                            className={futbolButtonClass('primary', 'flex-1 px-2 py-1 text-xs')}
                            onClick={async () => {
                              if (!pickedMatch) return;
                              await onAssign(pickedMatch, c.id, hora);
                              setOpenCell(null);
                              setPickedMatch('');
                            }}
                          >
                            Asignar
                          </button>
                          <button
                            type="button"
                            className={futbolButtonClass('ghost', 'px-2 py-1 text-xs')}
                            onClick={() => {
                              setOpenCell(null);
                              setPickedMatch('');
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex w-full items-center justify-center rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-[#3d7a3d] hover:text-[#3d7a3d]"
                        onClick={() => {
                          setOpenCell(key);
                          setPickedMatch('');
                        }}
                        title="Asignar partido pendiente"
                      >
                        + Asignar
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HorariosCanchasPanel() {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [grid, setGrid] = useState<SaturdayGridResponse | null>(null);
  const [pendientes, setPendientes] = useState<FootballMatch[]>([]);
  const [torneos, setTorneos] = useState<FootballTorneo[]>([]);
  const [selectedTorneoId, setSelectedTorneoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !fecha) return;
    setLoading(true);
    setError(null);
    try {
      const [gridResp, allPendientes, torneosResp] = await Promise.all([
        footballApi.scheduling.saturdayGrid(token, fecha),
        footballApi.matches.list(token, { status: 'pendiente' }),
        footballApi.torneos(token),
      ]);
      setGrid(gridResp);
      setTorneos(torneosResp);
      if (!selectedTorneoId && torneosResp[0]) setSelectedTorneoId(torneosResp[0].id);
      setPendientes(
        allPendientes.filter((m) => {
          const matchFecha = (m.date || m.jornada?.fecha || '').slice(0, 10);
          return matchFecha === fecha && (!m.canchaId || !m.horaInicio);
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la grilla');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const partidosHombres = useMemo(
    () => grid?.partidos.filter((p) => p.genero === 'hombres') ?? [],
    [grid],
  );
  const partidosMujeres = useMemo(
    () => grid?.partidos.filter((p) => p.genero === 'mujeres') ?? [],
    [grid],
  );
  const sinGenero = useMemo(
    () => grid?.partidos.filter((p) => p.genero !== 'hombres' && p.genero !== 'mujeres') ?? [],
    [grid],
  );

  // Las canchas de "mujeres" y las de "hombres_a"/"hombres_b" comparten
  // numeración (ambos grupos tienen cancha 1, 2, 3...), así que hay que
  // filtrar por grupoCanchas.codigo — no alcanza con mostrar grid.canchas
  // tal cual en las dos grillas, o se duplican columnas con el mismo número.
  const canchasHombres = useMemo(
    () => (grid?.canchas ?? []).filter((c) => c.grupoCanchas?.codigo?.startsWith('hombres')),
    [grid],
  );
  const canchasMujeres = useMemo(
    () => (grid?.canchas ?? []).filter((c) => c.grupoCanchas?.codigo === 'mujeres'),
    [grid],
  );

  async function assignMatch(matchId: string, canchaId: string, hora: string) {
    const token = getAccessToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await footballApi.matches.updateSchedule(
        matchId,
        { canchaId, horaInicio: hora, bloqueadoManual: true },
        token,
      );
      setSuccess('Partido asignado a la celda seleccionada.');
      if (result.warnings.length) {
        setSuccess((s) => `${s} Avisos: ${result.warnings.join('; ')}`);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar el partido');
    } finally {
      setBusy(false);
    }
  }

  async function suspendMatch(matchId: string) {
    const token = getAccessToken();
    if (!token) return;
    if (!confirm('¿Suspender este partido y crear/reutilizar su recuperación?')) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await footballApi.matches.suspend(matchId, token);
      setSuccess(
        `Partido suspendido. Recuperación programada para ${new Date(
          result.recoveryFecha,
        ).toLocaleDateString('es-AR')}.`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo suspender el partido');
    } finally {
      setBusy(false);
    }
  }

  async function suspendJornadaCategoria() {
    const token = getAccessToken();
    if (!token || !selectedTorneoId || !fecha) return;
    if (!confirm('¿Suspender por lluvia la jornada de esta categoría en esta fecha?')) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const jornadasTorneo = await footballApi.jornadas.list(token, selectedTorneoId);
      const jornada = jornadasTorneo.find((j) => j.fecha.slice(0, 10) === fecha);
      if (!jornada) {
        setError('No se encontró una jornada de esa categoría en esta fecha.');
        return;
      }
      const result = await footballApi.jornadas.suspendRain(jornada.id, token);
      setSuccess(
        `Jornada suspendida. Recuperación #${result.recoveryNumero} — ${result.movedMatches} partido(s) movidos.`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo suspender la jornada');
    } finally {
      setBusy(false);
    }
  }

  async function suspendSaturday() {
    const token = getAccessToken();
    if (!token || !fecha) return;
    if (!confirm('¿Suspender el sábado completo? Se moverán los partidos pendientes de TODAS las categorías.')) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await footballApi.scheduling.suspendSaturday(token, fecha);
      const totalMovidos = result.detalle.reduce((acc, d) => acc + d.movedMatches, 0);
      setSuccess(
        `Sábado suspendido: ${result.jornadasSuspendidas} jornada(s) — ${totalMovidos} partido(s) movidos a recuperación.`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo suspender el sábado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FutbolPanelShell
      title="Horarios y Canchas"
      subtitle="Asigná horarios y canchas por jornada"
    >
      <p className="text-sm text-muted-foreground">
        Elegí la fecha para administrar las grillas de hombres y mujeres: asigná partidos
        pendientes a una celda vacía, o suspendé por lluvia a nivel partido, categoría o sábado
        completo.
      </p>

      <div className={futbolCardClass('flex flex-wrap items-end gap-2 p-4')}>
        <label className="space-y-1 text-xs text-muted-foreground">
          Fecha (sábado)
          <input
            type="date"
            className={futbolFieldClass('max-w-[180px]')}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <button type="button" className={futbolButtonClass('ghost')} disabled={loading} onClick={() => void reload()}>
          Refrescar grilla
        </button>
      </div>

      {error && <FutbolError message={error} />}
      {success && <FutbolSuccess message={success} />}

      <div className={futbolCardClass('space-y-3 p-4')}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Ban size={16} className="text-red-600 dark:text-red-300" />
          Suspender por lluvia
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <select
            className={futbolFieldClass('max-w-[260px]')}
            value={selectedTorneoId}
            onChange={(e) => setSelectedTorneoId(e.target.value)}
          >
            <option value="">Elegir categoría / torneo...</option>
            {torneos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.categoria?.nombre ?? t.nombre} {t.campeonato?.nombre ? `(${t.campeonato.nombre})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selectedTorneoId}
            className={futbolButtonClass('ghost')}
            onClick={() => void suspendJornadaCategoria()}
          >
            Suspender jornada (categoría)
          </button>
          <button
            type="button"
            disabled={busy}
            className={futbolButtonClass()}
            onClick={() => void suspendSaturday()}
          >
            Suspender sábado completo
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Suspender un partido puntual se hace desde el botón "Suspender" dentro de cada celda
          ocupada de las grillas de abajo.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando grilla...</p>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Hombres</h3>
            <GenderGrid
              titulo="Hombres"
              genero="hombres"
              partidos={partidosHombres}
              canchas={canchasHombres}
              pendientes={pendientes}
              onAssign={assignMatch}
              onSuspendMatch={suspendMatch}
              busy={busy}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Mujeres</h3>
            <GenderGrid
              titulo="Mujeres"
              genero="mujeres"
              partidos={partidosMujeres}
              canchas={canchasMujeres}
              pendientes={pendientes}
              onAssign={assignMatch}
              onSuspendMatch={suspendMatch}
              busy={busy}
            />
          </div>
          {sinGenero.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Hay {sinGenero.length} partido(s) sin género asignado en la categoría, no se muestran
              en ninguna de las 2 grillas.
            </p>
          )}
        </div>
      )}
    </FutbolPanelShell>
  );
}
