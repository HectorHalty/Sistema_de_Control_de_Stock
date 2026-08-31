import { useCallback, useEffect, useState } from 'react';
import { mediaApi, type MediaItem } from '@/app/api/client';
import { FutbolError, FutbolPanelShell, futbolFieldClass } from '../futbol-shared';

export function MediaPanel() {
  const [rows, setRows] = useState<MediaItem[]>([]);
  const [matchDate, setMatchDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await mediaApi.list(undefined, matchDate || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [matchDate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <FutbolPanelShell title="Media por fecha">
      <p className="text-sm text-muted-foreground">
        Fotos y videos vinculados a fechas de partido. Subí archivos desde la API de media (MinIO).
      </p>
      {error && <FutbolError message={error} />}
      <input
        type="date"
        className={`${futbolFieldClass()} max-w-xs`}
        value={matchDate}
        onChange={(e) => setMatchDate(e.target.value)}
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-border bg-card p-3 hover:border-primary"
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.type} · {item.matchDate ?? 'Sin fecha'}
              </p>
            </a>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin media para el filtro seleccionado.</p>
          )}
        </div>
      )}
    </FutbolPanelShell>
  );
}
