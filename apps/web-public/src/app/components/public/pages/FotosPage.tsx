import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../../../api/public-api';
import { PageLoader } from '../../ui/PageLoader';
import { IconHeart, IconVideo } from '../figma-icons';

type Filter = 'todo' | 'fotos' | 'videos';

export function FotosPage() {
  const [filter, setFilter] = useState<Filter>('todo');
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['media'],
    queryFn: () => publicApi.media(),
  });

  const filtered = useMemo(() => {
    if (filter === 'todo') return data;
    return data.filter((m) => (filter === 'fotos' ? m.type !== 'video' : m.type === 'video'));
  }, [data, filter]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, typeof filtered>>((acc, item) => {
      const key = item.matchDate ?? 'Sin fecha';
      (acc[key] ??= []).push(item);
      return acc;
    }, {});
  }, [filtered]);

  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
          {(error as Error).message}
        </div>
      </div>
    );
  }

  const lightboxItem = data.find((p) => p.id === lightbox);

  return (
    <div className="mx-auto p-6" style={{ maxWidth: '56rem' }}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p style={{ color: '#6BFF9E' }} className="mb-1 text-xs font-bold uppercase tracking-widest">
            La Chacra Fútbol
          </p>
          <h1 className="text-2xl font-black text-white">Fotos & Videos</h1>
          <p className="mt-0.5 text-sm text-gray-500">Las mejores jugadas de cada jornada.</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {([['todo', 'Todo'], ['fotos', 'Fotos'], ['videos', 'Videos']] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilter(val)}
            style={
              filter === val
                ? { background: '#6BFF9E', color: '#0e0e0e' }
                : { background: '#1c1c1c', color: '#9ca3af', border: '1px solid #2a2a2a' }
            }
            className="rounded-lg px-4 py-1.5 text-sm font-bold"
          >
            {label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-gray-600">{filtered.length} archivos</span>
      </div>

      {!filtered.length ? (
        <p className="py-12 text-center text-sm text-gray-500">Todavía no hay fotos o videos publicados.</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([group, photos]) => (
            <div key={group}>
              <div className="mb-3 flex items-center gap-3">
                <div style={{ width: 3, height: 16, background: '#6BFF9E', borderRadius: 2 }} />
                <p className="text-sm font-bold text-white">{group}</p>
                <span className="text-xs text-gray-600">
                  {photos.length} {photos.length === 1 ? 'archivo' : 'archivos'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="group relative cursor-pointer overflow-hidden rounded-xl"
                    style={{ aspectRatio: '4/3' }}
                    onClick={() => setLightbox(photo.id)}
                  >
                    {photo.type === 'video' ? (
                      <div className="flex h-full w-full items-center justify-center bg-[#161616]">
                        <span style={{ color: '#6BFF9E' }}>
                          <IconVideo />
                        </span>
                      </div>
                    ) : (
                      <img
                        src={photo.url}
                        alt={photo.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    {photo.type === 'video' && (
                      <div className="absolute left-2 top-2">
                        <div
                          style={{ background: '#0e0e0ecc', border: '1px solid #ffffff22' }}
                          className="flex items-center gap-1 rounded-full px-2 py-1"
                        >
                          <span style={{ color: '#6BFF9E' }}>
                            <IconVideo />
                          </span>
                          <span className="text-[10px] font-bold text-white">VIDEO</span>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-end bg-black/0 p-3 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                      <div className="flex w-full items-center justify-between">
                        <span className="truncate text-[10px] font-semibold text-white">{photo.title}</span>
                        <span
                          className="flex items-center gap-1"
                          style={{ color: liked.has(photo.id) ? '#6BFF9E' : 'white' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLiked((prev) => {
                              const next = new Set(prev);
                              next.has(photo.id) ? next.delete(photo.id) : next.add(photo.id);
                              return next;
                            });
                          }}
                          role="presentation"
                        >
                          <IconHeart />
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-2xl font-black text-white hover:text-[#6BFF9E]"
            >
              ✕
            </button>
            <img
              src={lightboxItem.url}
              alt={lightboxItem.title}
              className="max-h-[70vh] w-full rounded-2xl object-cover"
            />
            <div
              style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
              className="-mt-1 flex items-center justify-between rounded-b-2xl px-5 py-4"
            >
              <div>
                <p className="text-sm font-bold text-white">{lightboxItem.title}</p>
                <p className="text-xs text-gray-500">{lightboxItem.matchDate ?? ''}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
