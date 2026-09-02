import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../../../api/public-api';
import { PageLoader } from '../../ui/PageLoader';

export function ReglamentoPage() {
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reglamento'],
    queryFn: () => publicApi.reglamento(),
  });

  if (isLoading) return <PageLoader />;

  if (error || !data?.apartados?.length) {
    return (
      <div className="space-y-5 p-6" style={{ maxWidth: 700, margin: '0 auto' }}>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">La Chacra Fútbol</p>
          <h1 className="text-2xl font-black text-white">Reglamento del Torneo</h1>
        </div>
        <div
          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
          className="rounded-2xl p-10 text-center"
        >
          <p className="text-gray-400">Todavía no hay reglamento cargado en el sistema.</p>
          <p className="mt-2 text-sm text-gray-600">
            Cuando el administrador publique el reglamento, lo verás acá.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">La Chacra Fútbol</p>
        <h1 className="text-2xl font-black text-white">Reglamento del Torneo</h1>
      </div>
      <div
        style={{ background: '#6BFF9E15', border: '1px solid #6BFF9E33' }}
        className="flex items-start gap-3 rounded-xl px-5 py-3"
      >
        <span style={{ color: '#6BFF9E', fontSize: 20 }}>⚠</span>
        <p className="text-xs leading-relaxed text-gray-300">
          Este reglamento es de cumplimiento obligatorio para todos los equipos y jugadores inscriptos. El
          desconocimiento del mismo no exime de su cumplimiento.
        </p>
      </div>
      <div className="space-y-2">
        {data.apartados.map((ap) => {
          const num = String(ap.numero).padStart(2, '0');
          const isOpen = open === ap.id;
          return (
            <div
              key={ap.id}
              style={{
                background: '#1c1c1c',
                border: isOpen ? '1px solid #6BFF9E44' : '1px solid #2a2a2a',
              }}
              className="overflow-hidden rounded-xl"
            >
              <button
                type="button"
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
                onClick={() => setOpen(isOpen ? null : ap.id)}
              >
                <span
                  style={{ color: '#6BFF9E', fontVariantNumeric: 'tabular-nums' }}
                  className="w-6 shrink-0 text-xs font-black opacity-60"
                >
                  {num}
                </span>
                <span className="flex-1 text-sm font-bold text-white">{ap.titulo}</span>
                <span
                  style={{ color: isOpen ? '#6BFF9E' : '#6b7280' }}
                  className="shrink-0 text-lg font-black"
                >
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-[#2a2a2a] px-5 py-4">
                  {ap.articulos.map((art) => (
                    <div key={art.id}>
                      <p className="text-xs font-black text-[#6BFF9E]">Art. {art.numero}</p>
                      <p className="mt-1 text-sm leading-relaxed text-gray-400">{art.contenido}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
