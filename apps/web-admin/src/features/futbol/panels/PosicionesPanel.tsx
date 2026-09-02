import { useCallback, useEffect, useState } from 'react';
import { footballApi, getAccessToken, type StandingRow } from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  useFutbolOverview,
} from '../futbol-shared';

function difLabel(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

export function PosicionesPanel() {
  const { torneoId, data: overview } = useFutbolOverview();
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !torneoId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await footballApi.standings(token, torneoId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tabla');
    } finally {
      setLoading(false);
    }
  }, [torneoId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <FutbolPanelShell title="Tabla de posiciones">
      <p className="text-sm text-muted-foreground">
        Calculada desde resultados cargados en el torneo{' '}
        {overview?.torneo?.nombre ? `· ${overview.torneo.nombre}` : ''}.
        Se publica en la web cuando el torneo está marcado como publicado.
      </p>
      {error && <FutbolError message={error} />}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : !rows.length ? (
        <p className="text-sm text-muted-foreground">Sin equipos o partidos en este torneo.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Equipo</th>
                <th className="px-3 py-3 text-center">PJ</th>
                <th className="px-3 py-3 text-center">PG</th>
                <th className="px-3 py-3 text-center">PE</th>
                <th className="px-3 py-3 text-center">PP</th>
                <th className="px-3 py-3 text-center">GF</th>
                <th className="px-3 py-3 text-center">GC</th>
                <th className="px-3 py-3 text-center">DG</th>
                <th className="px-4 py-3 text-center">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const dg = row.goalDiff ?? row.goalsFor - row.goalsAgainst;
                return (
                  <tr key={row.inscripcionId ?? row.teamId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">{row.teamName ?? row.teamId}</td>
                    <td className="px-3 py-3 text-center">{row.played}</td>
                    <td className="px-3 py-3 text-center">{row.won}</td>
                    <td className="px-3 py-3 text-center">{row.drawn}</td>
                    <td className="px-3 py-3 text-center">{row.lost}</td>
                    <td className="px-3 py-3 text-center">{row.goalsFor}</td>
                    <td className="px-3 py-3 text-center">{row.goalsAgainst}</td>
                    <td
                      className="px-3 py-3 text-center font-semibold"
                      style={{ color: dg > 0 ? '#6bff9e' : dg < 0 ? '#ef4444' : undefined }}
                    >
                      {difLabel(dg)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-primary">{row.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </FutbolPanelShell>
  );
}
