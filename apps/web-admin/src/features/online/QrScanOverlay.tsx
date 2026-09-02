import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine, X } from 'lucide-react';
import { onlineButtonClass, onlineFieldClass } from './online-shared';

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (token: string) => void;
  loading?: boolean;
};

export function QrScanOverlay({ open, onClose, onScan, loading }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manual, setManual] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scanningRef = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      scanningRef.current = false;
      setManual('');
      setCameraError(null);
      return;
    }

    let cancelled = false;
    scanningRef.current = true;

    async function start() {
      if (!('mediaDevices' in navigator)) {
        setCameraError('Cámara no disponible en este dispositivo. Ingresá el código manualmente.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ('BarcodeDetector' in window) {
          // @ts-expect-error BarcodeDetector no está en lib.dom estándar
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          const tick = async () => {
            if (!scanningRef.current || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              const raw = codes[0]?.rawValue?.trim();
              if (raw) {
                scanningRef.current = false;
                onScan(raw.toUpperCase());
                return;
              }
            } catch {
              /* ignore frame errors */
            }
            if (scanningRef.current) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        } else {
          setCameraError('Escaneo automático no soportado. Ingresá el código manualmente.');
        }
      } catch {
        setCameraError('No se pudo acceder a la cámara. Ingresá el código manualmente.');
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, onScan, stopCamera]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="flex items-center gap-2 font-bold">
          <ScanLine size={20} />
          Escanear QR de retiro
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10">
          <X size={22} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-8">
        {!cameraError && (
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-[#6BFF9E]">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-dashed border-white/60" />
          </div>
        )}

        {cameraError && (
          <p className="max-w-md text-center text-sm text-gray-300">{cameraError}</p>
        )}

        <form
          className="flex w-full max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onScan(manual.trim().toUpperCase());
          }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="LCH-XXXXXXXX"
            className={`${onlineFieldClass()} font-mono uppercase`}
            autoComplete="off"
          />
          <button type="submit" disabled={loading || !manual.trim()} className={onlineButtonClass()}>
            OK
          </button>
        </form>
      </div>
    </div>
  );
}
