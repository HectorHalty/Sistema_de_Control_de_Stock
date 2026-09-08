import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { getAccessToken, mediaApi } from '@/app/api/client';
import { futbolButtonClass } from '../futbol-shared';

type Props = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
};

/**
 * Mismo flujo que OnlineMediaUpload.tsx (presign -> PUT directo a MinIO ->
 * onChange(publicUrl), sin llamar a /media/confirm) pero con los estilos de
 * Futbol en vez de los de Online, para no acoplar features por estética.
 */
export function TeamLogoUpload({ value, onChange, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const token = getAccessToken();
    if (!token) return;
    setUploading(true);
    setError(null);
    try {
      const presign = await mediaApi.presign(
        { type: 'image', fileName: file.name, mimeType: file.type, size: file.size },
        token,
      );
      const res = await fetch(presign.uploadUrl, {
        method: presign.method || 'PUT',
        headers: presign.headers,
        body: file,
      });
      if (!res.ok) throw new Error('No se pudo subir el archivo');
      if (!presign.publicUrl) throw new Error('URL pública no disponible');
      onChange(presign.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-14 w-14 rounded-xl border border-border object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
            <Upload size={18} />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={uploading}
          className={`${futbolButtonClass('ghost')} flex items-center gap-2`}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={16} />
          {uploading ? 'Subiendo...' : value ? 'Cambiar logo' : 'Subir logo'}
        </button>
        {value && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-300"
            onClick={() => onChange('')}
          >
            Quitar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
