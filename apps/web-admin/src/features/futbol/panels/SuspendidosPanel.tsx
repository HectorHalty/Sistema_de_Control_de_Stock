import { useCallback, useEffect, useState } from 'react';
import { Pencil, RefreshCw } from 'lucide-react';
import { footballApi, getAccessToken, type FootballSuspension } from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  FutbolSuccess,
  futbolButtonClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';

function FechasRestantesCell({
  row,
  onSave,
}: {
  row: FootballSuspension;
  onSave: (fechasRestantes: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.fechasRestantes ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(row.fechasRestantes ?? 0));
    setEditing(false);
  }, [row.fechasRestantes, row.id]);

  async function commit() {
    setSaving(true);
    try {
      await onSave(Number(value) || 0);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (row.fechasRestantes === null) {
    if (!editing) {
      return (
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            A definir
          </span>
          <button
            type="button"
            className={futbolButtonClass('ghost')}
            onClick={() => {
              setValue('0');
              setEditing(true);
            }}
          >
            Definir cantidad de fechas
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          autoFocus
          className={`${futbolFieldClass()} w-20`}
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="button"
          disabled={saving}
          className={futbolButtonClass()}
          onClick={() => void commit()}
        >
          Guardar
        </button>
        <button
          type="button"
          disabled={saving}
          className={futbolButtonClass('ghost')}
          onClick={() => setEditing(false)}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <>
          <input
            type="number"
            min={0}
            autoFocus
            className={`${futbolFieldClass()} w-20`}
            value={value}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            type="button"
            disabled={saving}
            className={futbolButtonClass()}
            onClick={() => void commit()}
          >
            Guardar
          </button>
          <button
            type="button"
            disabled={saving}
            className={futbolButtonClass('ghost')}
            onClick={() => setEditing(false)}
          >
            Cancelar
          </button>
        </>
      ) : (
        <>
          <span className="font-medium">{row.fechasRestantes}</span>
          <button
            type="button"
            aria-label="Editar fechas restantes"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil size={14} />
          </button>
        </>
      )}
      {row.ajustadoManualmente && (
        <span className="text-xs text-muted-foreground" title="No se pisa al sincronizar desde eventos">
          (editado manualmente)
        </span>
      )}
    </div>
  );
}

export function SuspendidosPanel() {
  const { torneoId } = useFutbolOverview();
  const [rows, setRows] = useState<FootballSuspension[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await footballApi.suspensions.list(token, torneoId ?? undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [torneoId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function updateRow(id: string, patch: { fechasRestantes?: number; activa?: boolean }) {
    const token = getAccessToken();
    if (!token) return;
    await footballApi.suspensions.update(id, patch, token);
    await reload();
  }

  async function syncFromEvents() {
    const token = getAccessToken();
    if (!token) return;
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await footballApi.suspensions.sync(token, torneoId ?? undefined);
      setSuccess(`Sincronizado desde eventos — ${result.updated} partido(s) revisados.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <FutbolPanelShell
      title="Suspendidos"
      subtitle="Sanciones automáticas al cargar tarjetas en Resultados; las fechas restantes se descuentan con cada partido jugado del equipo (salvo jornadas suspendidas por lluvia)"
    >

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={syncing || !torneoId}
          className={`${futbolButtonClass()} inline-flex items-center gap-2`}
          onClick={() => void syncFromEvents()}
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar desde eventos'}
        </button>
      </div>

      {success && <FutbolSuccess message={success} />}
      {error && <FutbolError message={error} />}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Jugador</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Fechas restantes</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    {row.persona?.apellido}, {row.persona?.nombre}
                  </td>
                  <td className="px-4 py-3">{row.persona?.dni}</td>
                  <td className="px-4 py-3">{row.motivo}</td>
                  <td className="px-4 py-3">
                    <FechasRestantesCell
                      row={row}
                      onSave={(fechasRestantes) => updateRow(row.id, { fechasRestantes })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={futbolButtonClass('ghost')}
                      onClick={() => updateRow(row.id, { activa: !row.activa })}
                    >
                      {row.activa ? 'Levantar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No hay suspensiones activas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </FutbolPanelShell>
  );
}
