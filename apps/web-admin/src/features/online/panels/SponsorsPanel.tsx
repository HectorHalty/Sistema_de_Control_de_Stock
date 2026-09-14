import { useCallback, useEffect, useMemo, useState } from 'react';
import { sponsorsApi, getAccessToken, type Sponsor } from '@/app/api/client';
import { OnlineMediaUpload } from '../OnlineMediaUpload';
import {
  SPONSOR_PLACEMENTS,
  placementOptionById,
} from '../sponsor-placements';
import {
  OnlineError,
  OnlinePanelShell,
  onlineButtonClass,
  onlineCardClass,
  onlineFieldClass,
} from '../online-shared';

export function SponsorsPanel() {
  const [rows, setRows] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [placementId, setPlacementId] = useState(SPONSOR_PLACEMENTS[0].id);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editPlacementId, setEditPlacementId] = useState(SPONSOR_PLACEMENTS[0].id);
  const [editMediaType, setEditMediaType] = useState<'image' | 'video'>('image');
  const [editDuration, setEditDuration] = useState(5);

  const selectedPlacement = useMemo(() => placementOptionById(placementId), [placementId]);

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
      await sponsorsApi.create(
        {
          name: name.trim(),
          imageUrl: imageUrl.trim(),
          placement: selectedPlacement.placement,
          bannerLabel: selectedPlacement.bannerLabel,
          mediaType,
          widthPx: selectedPlacement.widthPx,
          heightPx: selectedPlacement.heightPx,
          durationSeconds,
        },
        token,
      );
      setName('');
      setImageUrl('');
      setDurationSeconds(5);
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

  function startEdit(row: Sponsor) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditImageUrl(row.imageUrl);
    setEditMediaType((row.mediaType as 'image' | 'video') ?? 'image');
    setEditDuration(row.durationSeconds ?? 5);
    const match =
      SPONSOR_PLACEMENTS.find((p) => p.placement === row.placement) ?? SPONSOR_PLACEMENTS[0];
    setEditPlacementId(match.id);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !editingId) return;
    const placement = placementOptionById(editPlacementId);
    setSaving(true);
    try {
      await sponsorsApi.update(
        editingId,
        {
          name: editName.trim(),
          imageUrl: editImageUrl.trim(),
          placement: placement.placement,
          bannerLabel: placement.bannerLabel,
          mediaType: editMediaType,
          widthPx: placement.widthPx,
          heightPx: placement.heightPx,
          durationSeconds: editDuration,
        },
        token,
      );
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnlinePanelShell title="Sponsors" subtitle="Logos de sponsors en la web pública">
      {error && <OnlineError message={error} />}
      <form onSubmit={handleCreate} className={`${onlineCardClass('p-4')} space-y-3`}>
        <p className="text-sm text-muted-foreground">
          Elegí qué banner estás modificando. El tamaño recomendado se aplica automáticamente a la web
          pública.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Banner</label>
            <select
              className={onlineFieldClass()}
              value={placementId}
              onChange={(e) => setPlacementId(e.target.value)}
            >
              {SPONSOR_PLACEMENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de media</label>
            <select
              className={onlineFieldClass()}
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as 'image' | 'video')}
            >
              <option value="image">Imagen</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Segundos por banner (2–60)
            </label>
            <input
              type="number"
              min={2}
              max={60}
              className={onlineFieldClass()}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
            />
          </div>
          <input
            className={onlineFieldClass()}
            placeholder="Nombre del sponsor"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="md:col-span-2">
            <OnlineMediaUpload
              label="Imagen o video del banner"
              mediaType={mediaType}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-[#3d7a3d]/40 bg-[#3d7a3d]/5 px-4 py-3 text-sm">
          <p className="font-semibold">{selectedPlacement.bannerLabel}</p>
          <p className="text-muted-foreground">
            Tamaño recomendado:{' '}
            <strong>
              {selectedPlacement.widthPx} × {selectedPlacement.heightPx} px
            </strong>{' '}
            ({mediaType === 'video' ? 'video' : 'foto'})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{selectedPlacement.hint}</p>
        </div>
        <button type="submit" disabled={saving} className={onlineButtonClass()}>
          Agregar sponsor
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className={onlineCardClass('p-4')}>
              <div
                className="mb-2 overflow-hidden rounded-lg bg-muted"
                style={{
                  height: row.heightPx ?? 86,
                  maxHeight: 120,
                }}
              >
                {row.mediaType === 'video' ? (
                  <video src={row.imageUrl} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={row.imageUrl} alt={row.name} className="h-full w-full object-contain" />
                )}
              </div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs font-medium text-[#3d7a3d]">
                {row.bannerLabel ?? row.placement}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.widthPx ?? '—'} × {row.heightPx ?? '—'} px · {row.mediaType ?? 'image'}
              </p>
              <p className="text-xs text-muted-foreground">{row.durationSeconds ?? 5}s por rotación</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={onlineButtonClass('ghost')} onClick={() => startEdit(row)}>
                  Editar
                </button>
                <button type="button" className={onlineButtonClass('ghost')} onClick={() => toggleActive(row)}>
                  {row.active ? 'Activo' : 'Inactivo'}
                </button>
              </div>
              {editingId === row.id && (
                <form onSubmit={saveEdit} className="mt-3 space-y-2 border-t border-border pt-3">
                  <select
                    className={onlineFieldClass()}
                    value={editPlacementId}
                    onChange={(e) => setEditPlacementId(e.target.value)}
                  >
                    {SPONSOR_PLACEMENTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={onlineFieldClass()}
                    value={editMediaType}
                    onChange={(e) => setEditMediaType(e.target.value as 'image' | 'video')}
                  >
                    <option value="image">Imagen</option>
                    <option value="video">Video</option>
                  </select>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    className={onlineFieldClass()}
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                  />
                  <input className={onlineFieldClass()} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <OnlineMediaUpload
                    mediaType={editMediaType}
                    value={editImageUrl}
                    onChange={setEditImageUrl}
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className={onlineButtonClass()}>
                      Guardar
                    </button>
                    <button type="button" className={onlineButtonClass('ghost')} onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </OnlinePanelShell>
  );
}
