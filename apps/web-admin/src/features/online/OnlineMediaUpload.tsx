import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { getAccessToken, mediaApi } from '@/app/api/client';
import { onlineButtonClass, onlineFieldClass } from './online-shared';

type Props = {
  value: string;
  onChange: (url: string) => void;
  mediaType?: 'image' | 'video';
  label?: string;
};

export function OnlineMediaUpload({ value, onChange, mediaType = 'image', label }: Props) {
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
        {
          type: mediaType,
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

      if (!res.ok) {
        throw new Error('No se pudo subir el archivo');
      }

      const url = presign.publicUrl ?? value;
      if (!presign.publicUrl) {
        throw new Error('URL pública no disponible');
      }

      // El archivo ya se subió a MinIO en este punto (el PUT de arriba fue
      // 2xx): avisamos al padre ya mismo para no perder una URL válida si
      // `confirm` (que sólo registra metadata en la base) falla después.
      onChange(url);

      try {
        await mediaApi.confirm(
          {
            key: presign.key,
            title: file.name,
            type: mediaType,
            url,
            mimeType: file.type,
            size: file.size,
          },
          token,
        );
      } catch (confirmErr) {
        // No fatal: el upload real ya tuvo éxito y el padre ya tiene la URL.
        // Sólo dejamos constancia de que el registro de metadata falló.
        console.warn('No se pudo confirmar el media subido en el backend', confirmErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={mediaType === 'video' ? 'video/*' : 'image/*'}
          className="hidden"
          data-testid="lch-media-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={uploading}
          className={`${onlineButtonClass('ghost')} flex items-center gap-2`}
          onClick={() => inputRef.current?.click()}
          data-testid="lch-media-upload"
        >
          <Upload size={16} />
          {uploading ? 'Subiendo...' : 'Subir archivo'}
        </button>
        <input
          className={`${onlineFieldClass()} min-w-[200px] flex-1`}
          placeholder="O pegá URL"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {value && mediaType === 'image' && (
        <img src={value} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
