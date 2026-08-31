import { useCallback, useEffect, useState } from 'react';
import { onlineApi, getAccessToken, type WebMenuProduct } from '@/app/api/client';
import { OnlineError, OnlinePanelShell, onlineButtonClass, onlineFieldClass } from '../online-shared';

export function MenuWebPanel() {
  const [rows, setRows] = useState<WebMenuProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await onlineApi.menu.list(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function toggleVisible(row: WebMenuProduct) {
    const token = getAccessToken();
    if (!token) return;
    setSavingId(row.id);
    try {
      await onlineApi.menu.update(row.id, { visibleWeb: !row.visibleWeb }, token);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSavingId(null);
    }
  }

  async function saveDescription(row: WebMenuProduct, descripcionWeb: string) {
    const token = getAccessToken();
    if (!token) return;
    setSavingId(row.id);
    try {
      await onlineApi.menu.update(row.id, { descripcionWeb: descripcionWeb || null }, token);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <OnlinePanelShell title="Menú web">
      <p className="text-sm text-muted-foreground">
        Productos de venta visibles en la cantina de la app pública. Los precios vienen del catálogo de ventas.
      </p>
      {error && <OnlineError message={error} />}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando menú...</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {row.emoji} {row.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.category} · {row.kitchen?.name} · ${Number(row.price).toLocaleString('es-AR')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingId === row.id}
                  className={onlineButtonClass(row.visibleWeb ? 'ghost' : 'primary')}
                  onClick={() => toggleVisible(row)}
                >
                  {row.visibleWeb ? 'Visible en web' : 'Oculto'}
                </button>
              </div>
              <textarea
                className={`${onlineFieldClass()} mt-3 min-h-[60px]`}
                placeholder="Descripción para la web pública"
                defaultValue={row.descripcionWeb ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (row.descripcionWeb ?? '')) {
                    void saveDescription(row, e.target.value);
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}
    </OnlinePanelShell>
  );
}
