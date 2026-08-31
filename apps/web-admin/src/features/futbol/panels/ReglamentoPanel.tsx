import { useCallback, useEffect, useState } from 'react';
import {
  footballApi,
  getAccessToken,
  type FootballReglamento,
  type FootballReglamentoArticulo,
} from '@/app/api/client';
import { FutbolError, FutbolPanelShell, futbolButtonClass, futbolFieldClass } from '../futbol-shared';

export function ReglamentoPanel() {
  const [data, setData] = useState<FootballReglamento | null>(null);
  const [selected, setSelected] = useState<FootballReglamentoArticulo | null>(null);
  const [contenido, setContenido] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await footballApi.reglamento.list(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (selected) setContenido(selected.contenido);
  }, [selected]);

  async function save() {
    const token = getAccessToken();
    if (!token || !selected) return;
    setSaving(true);
    try {
      await footballApi.reglamento.updateArticulo(selected.id, { contenido }, token);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FutbolPanelShell title="Reglamento">
      {error && <FutbolError message={error} />}
      {loading || !data ? (
        <p className="text-sm text-muted-foreground">Cargando reglamento...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border p-3">
            {data.apartados.map((ap) => (
              <div key={ap.id} className="mb-4">
                <p className="mb-2 text-sm font-bold">
                  {ap.numero}. {ap.titulo}
                </p>
                <ul className="space-y-1">
                  {ap.articulos.map((art) => (
                    <li key={art.id}>
                      <button
                        type="button"
                        className={`w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-muted ${
                          selected?.id === art.id ? 'bg-muted font-medium' : ''
                        }`}
                        onClick={() => setSelected(art)}
                      >
                        Art. {art.numero} {art.titulo ? `— ${art.titulo}` : ''}
                        {!art.aplicable && ' (no aplicable)'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div>
            {selected ? (
              <>
                <p className="mb-2 font-medium">
                  Artículo {selected.numero} {selected.titulo}
                </p>
                <textarea
                  className={`${futbolFieldClass()} min-h-[280px]`}
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                />
                <button type="button" disabled={saving} className={`${futbolButtonClass()} mt-3`} onClick={save}>
                  {saving ? 'Guardando...' : 'Guardar artículo'}
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Seleccioná un artículo para editar.</p>
            )}
          </div>
        </div>
      )}
    </FutbolPanelShell>
  );
}
