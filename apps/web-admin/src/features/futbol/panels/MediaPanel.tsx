import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { getAccessToken, mediaApi, type MediaItem } from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
} from '../futbol-shared';

export function MediaPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<MediaItem[]>([]);
  const [matchDate, setMatchDate] = useState('');
  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploadDate, setUploadDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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

  async function handleUpload(file: File) {
    const token = getAccessToken();
    if (!token) return;
    if (!title.trim()) {
      setError('Ingresá un título para el archivo');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const presign = await mediaApi.presign(
        {
          type,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        },
        token,
      );

      const res = await fetch(presign.uploadUrl, {
        method: presign.method || 'PUT',
        headers: presign.headers,
        body: file,
      });

      if (!res.ok) throw new Error('No se pudo subir el archivo a MinIO');

      const publicUrl = presign.publicUrl;
      if (!publicUrl) throw new Error('URL pública no disponible');

      await mediaApi.confirm(
        {
          key: presign.key,
          title: title.trim(),
          type,
          url: publicUrl,
          mimeType: file.type,
          size: file.size,
          matchDate: uploadDate || undefined,
        },
        token,
      );

      setTitle('');
      setUploadDate('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    const token = getAccessToken();
    if (!token || !confirm('¿Eliminar este archivo?')) return;
    try {
      await mediaApi.remove(id, token);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  return (
    <FutbolPanelShell title="Media por fecha">
      <p className="text-sm text-muted-foreground">
        Fotos y videos vinculados a fechas de partido. Se almacenan en MinIO y pueden mostrarse en la web
        pública.
      </p>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Subir archivo</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={futbolFieldClass()}
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="date"
            className={futbolFieldClass()}
            value={uploadDate}
            onChange={(e) => setUploadDate(e.target.value)}
          />
          <select
            className={futbolFieldClass()}
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as 'image' | 'video')}
          >
            <option value="image">Imagen</option>
            <option value="video">Video</option>
          </select>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={mediaType === 'video' ? 'video/*' : 'image/*'}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={uploading}
          className={`${futbolButtonClass()} inline-flex items-center gap-2`}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={16} />
          {uploading ? 'Subiendo...' : 'Elegir archivo y subir'}
        </button>
      </div>

      {error && <FutbolError message={error} />}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-muted-foreground">
          Filtrar por fecha
          <input
            type="date"
            className={`${futbolFieldClass()} mt-1 max-w-xs`}
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              {item.type === 'image' && item.url && (
                <img src={item.url} alt={item.title} className="h-32 w-full object-cover" />
              )}
              {item.type === 'video' && item.url && (
                <video src={item.url} className="h-32 w-full object-cover" muted />
              )}
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.type} · {item.matchDate ?? 'Sin fecha'}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Abrir
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(item.id)}
                  className="shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                  aria-label="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin media para el filtro seleccionado.</p>
          )}
        </div>
      )}
    </FutbolPanelShell>
  );
}
