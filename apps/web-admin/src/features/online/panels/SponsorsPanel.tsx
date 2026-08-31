import { useCallback, useEffect, useState } from 'react';
import { sponsorsApi, getAccessToken, type Sponsor } from '@/app/api/client';
import { OnlineError, OnlinePanelShell, onlineButtonClass, onlineFieldClass } from '../online-shared';

export function SponsorsPanel() {
  const [rows, setRows] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [placement, setPlacement] = useState('banner');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await sponsorsApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !name.trim() || !imageUrl.trim()) return;
    setSaving(true);
    try {
      await sponsorsApi.create({ name: name.trim(), imageUrl: imageUrl.trim(), placement }, token);
      setName('');
      setImageUrl('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: Sponsor) {
    const token = getAccessToken();
    if (!token) return;
    await sponsorsApi.update(row.id, { active: !row.active }, token);
    await reload();
  }

  return (
    <OnlinePanelShell title="Sponsors">
      {error && <OnlineError message={error} />}
      <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <input
          className={onlineFieldClass()}
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={onlineFieldClass()}
          placeholder="URL imagen"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <select
          className={onlineFieldClass()}
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
        >
          <option value="banner">Banner</option>
          <option value="sidebar">Sidebar</option>
          <option value="footer">Footer</option>
        </select>
        <button type="submit" disabled={saving} className={onlineButtonClass()}>
          Agregar sponsor
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border bg-card p-4">
              <img src={row.imageUrl} alt={row.name} className="mb-2 h-20 w-full rounded-lg object-contain" />
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.placement}</p>
              <button
                type="button"
                className={`${onlineButtonClass('ghost')} mt-2`}
                onClick={() => toggleActive(row)}
              >
                {row.active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          ))}
        </div>
      )}
    </OnlinePanelShell>
  );
}
