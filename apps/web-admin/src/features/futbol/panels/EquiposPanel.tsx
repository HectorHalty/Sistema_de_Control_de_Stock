import { useCallback, useEffect, useState } from 'react';
import {
  footballApi,
  getAccessToken,
  type FootballInscription,
} from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';

export function EquiposPanel() {
  const { torneoId } = useFutbolOverview();
  const [rows, setRows] = useState<FootballInscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [color, setColor] = useState('#6BFF9E');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await footballApi.inscriptions.list(token, torneoId ?? undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [torneoId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !torneoId || !name.trim()) return;
    setSaving(true);
    try {
      await footballApi.inscriptions.create(
        { torneoId, name: name.trim(), shortName: shortName.trim() || undefined, color },
        token,
      );
      setName('');
      setShortName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FutbolPanelShell title="Equipos">
      {error && <FutbolError message={error} />}
      <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <input
          className={futbolFieldClass()}
          placeholder="Nombre del equipo"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={futbolFieldClass()}
          placeholder="Sigla"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
        />
        <input
          type="color"
          className="h-10 w-full rounded-lg border border-border bg-background"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <button type="submit" disabled={saving || !torneoId} className={futbolButtonClass()}>
          {saving ? 'Guardando...' : 'Agregar equipo'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando equipos...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Equipo</th>
                <th className="px-4 py-3">Sigla</th>
                <th className="px-4 py-3">Jugadores</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-full"
                      style={{ background: row.color ?? row.equipo.color ?? '#6BFF9E' }}
                    />
                    {row.equipo.name}
                  </td>
                  <td className="px-4 py-3">{row.abbr ?? row.equipo.shortName ?? '—'}</td>
                  <td className="px-4 py-3">{row._count?.jugadores ?? 0}</td>
                  <td className="px-4 py-3">{row.activo ? 'Activo' : 'Inactivo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FutbolPanelShell>
  );
}
