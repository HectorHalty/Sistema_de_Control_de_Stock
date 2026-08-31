import { useCallback, useEffect, useState } from 'react';
import { footballApi, getAccessToken, type FootballMatch } from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';

export function ResultadosPanel() {
  const { torneoId } = useFutbolOverview();
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await footballApi.matches.list(token, { torneoId: torneoId ?? undefined });
      setMatches(rows);
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
      {error && <FutbolError message={error} />}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando partidos...</p>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-[180px] flex-1 font-medium">{m.homeTeam?.name}</div>
              <input
                className={`${futbolFieldClass()} w-16 text-center`}
                value={scores[m.id]?.home ?? '0'}
                onChange={(e) =>
                  setScores((prev) => ({
                    ...prev,
                    [m.id]: { ...prev[m.id], home: e.target.value, away: prev[m.id]?.away ?? '0' },
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
              <div className="min-w-[180px] flex-1 text-right font-medium">{m.awayTeam?.name}</div>
              <button type="button" className={futbolButtonClass('ghost')} onClick={() => saveScore(m.id)}>
                Guardar
              </button>
              <span className="w-full text-xs text-muted-foreground">
                {new Date(m.date).toLocaleDateString('es-AR')}
                {m.horaInicio ? ` · ${m.horaInicio}` : ''} · {m.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </FutbolPanelShell>
  );
}
