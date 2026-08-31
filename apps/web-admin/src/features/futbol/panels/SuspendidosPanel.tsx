import { useCallback, useEffect, useState } from 'react';
import { footballApi, getAccessToken, type FootballSuspension } from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';

export function SuspendidosPanel() {
  const { torneoId } = useFutbolOverview();
  const [rows, setRows] = useState<FootballSuspension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <FutbolPanelShell title="Suspendidos">
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
                    <input
                      type="number"
                      min={0}
                      className={`${futbolFieldClass()} w-20`}
                      defaultValue={row.fechasRestantes}
                      onBlur={(e) =>
                        updateRow(row.id, { fechasRestantes: Number(e.target.value) || 0 })
                      }
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
