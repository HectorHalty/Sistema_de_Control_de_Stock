import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onlineApi,
  salesApi,
  getAccessToken,
  type Kitchen,
  type SalesProduct,
  type WebCategory,
  type WebFilter,
  type WebMenuProduct,
} from '@/app/api/client';
import { OnlineMediaUpload } from '../OnlineMediaUpload';
import { SalesProductPicker } from '../SalesProductPicker';
import { OnlineError, OnlinePanelShell, onlineButtonClass, onlineFieldClass } from '../online-shared';

type Tab = 'productos' | 'categorias' | 'filtros';

const emptyProduct = {
  salesProductId: null as string | null,
  name: '',
  category: 'Comidas',
  kitchenId: '',
  price: '',
  emoji: '',
  descripcionWeb: '',
  imagenWeb: '',
  webCategoryId: '',
  popularWeb: false,
  filterIds: [] as string[],
};

export function MenuWebPanel() {
  const [tab, setTab] = useState<Tab>('productos');
  const [rows, setRows] = useState<WebMenuProduct[]>([]);
  const [salesProducts, setSalesProducts] = useState<SalesProduct[]>([]);
  const [categories, setCategories] = useState<WebCategory[]>([]);
  const [filters, setFilters] = useState<WebFilter[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState(emptyProduct);
  const [newCategory, setNewCategory] = useState('');
  const [newFilter, setNewFilter] = useState('');

  const alreadyOnWebIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [menu, cats, filts, ks, sales] = await Promise.all([
        onlineApi.menu.list(token),
        onlineApi.categories.list(token),
        onlineApi.filters.list(token),
        onlineApi.kitchens.list(token),
        salesApi.products.list(),
      ]);
      setRows(menu);
      setSalesProducts(sales.filter((p) => p.active));
      setCategories(cats);
      setFilters(filts);
      setKitchens(ks);
      setDraft((d) => (d.kitchenId ? d : { ...d, kitchenId: ks[0]?.id ?? '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function applySalesProduct(product: SalesProduct | null) {
    if (!product) {
      setDraft((d) => ({ ...emptyProduct, kitchenId: d.kitchenId || kitchens[0]?.id || '' }));
      return;
    }
    setDraft({
      salesProductId: product.id,
      name: product.name,
      category: product.category,
      kitchenId: product.kitchenId,
      price: String(product.price),
      emoji: product.emoji ?? '',
      descripcionWeb: '',
      imagenWeb: '',
      webCategoryId: '',
      popularWeb: false,
      filterIds: [],
    });
  }

  async function saveProduct(row: WebMenuProduct, patch: Partial<WebMenuProduct> & { filterIds?: string[] }) {
    const token = getAccessToken();
    if (!token) return;
    setSavingId(row.id);
    try {
      await onlineApi.menu.update(row.id, patch, token);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !draft.salesProductId) {
      setError('Seleccioná un producto de ventas');
      return;
    }
    setSavingId('new');
    setError(null);
    try {
      await onlineApi.menu.update(
        draft.salesProductId,
        {
          name: draft.name.trim() || undefined,
          category: draft.category.trim() || undefined,
          kitchenId: draft.kitchenId || undefined,
          price: Number(draft.price) || 0,
          emoji: draft.emoji || undefined,
          descripcionWeb: draft.descripcionWeb || null,
          imagenWeb: draft.imagenWeb || null,
          visibleWeb: true,
          webCategoryId: draft.webCategoryId || null,
          popularWeb: draft.popularWeb,
          filterIds: draft.filterIds,
        },
        token,
      );
      setDraft({ ...emptyProduct, kitchenId: kitchens[0]?.id ?? '' });
      setShowCreate(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar al menú web');
    } finally {
      setSavingId(null);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !newCategory.trim()) return;
    await onlineApi.categories.create({ name: newCategory.trim() }, token);
    setNewCategory('');
    await reload();
  }

  async function addFilter(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !newFilter.trim()) return;
    await onlineApi.filters.create({ label: newFilter.trim() }, token);
    setNewFilter('');
    await reload();
  }

  async function toggleCategory(cat: WebCategory) {
    const token = getAccessToken();
    if (!token) return;
    await onlineApi.categories.update(cat.id, { active: !cat.active }, token);
    await reload();
  }

  async function removeCategory(id: string) {
    const token = getAccessToken();
    if (!token || !confirm('¿Eliminar esta categoría?')) return;
    await onlineApi.categories.remove(id, token);
    await reload();
  }

  async function toggleFilter(f: WebFilter) {
    const token = getAccessToken();
    if (!token) return;
    await onlineApi.filters.update(f.id, { active: !f.active }, token);
    await reload();
  }

  async function removeFilter(id: string) {
    const token = getAccessToken();
    if (!token || !confirm('¿Eliminar este filtro?')) return;
    await onlineApi.filters.remove(id, token);
    await reload();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'productos', label: 'Productos' },
    { id: 'categorias', label: 'Categorías' },
    { id: 'filtros', label: 'Filtros' },
  ];

  return (
    <OnlinePanelShell title="Menú web">
      <p className="text-sm text-muted-foreground">
        Elegí productos ya creados en Ventas para publicarlos en la cantina. El precio se completa
        automáticamente y podés ajustarlo para promos web.
      </p>
      {error && <OnlineError message={error} />}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={onlineButtonClass(tab === t.id ? 'primary' : 'ghost')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : tab === 'categorias' ? (
        <div className="space-y-4">
          <form onSubmit={addCategory} className="flex flex-wrap gap-2">
            <input
              className={onlineFieldClass()}
              placeholder="Nueva categoría"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button type="submit" className={onlineButtonClass()}>
              Agregar
            </button>
          </form>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-xl border border-border bg-card p-3">
                <input
                  className={`${onlineFieldClass()} mb-2 font-medium`}
                  defaultValue={cat.name}
                  onBlur={async (e) => {
                    if (e.target.value === cat.name) return;
                    const token = getAccessToken();
                    if (!token || !e.target.value.trim()) return;
                    await onlineApi.categories.update(cat.id, { name: e.target.value.trim() }, token);
                    await reload();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {cat._count?.productos ?? 0} productos · slug: {cat.slug}
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className={onlineButtonClass('ghost')} onClick={() => toggleCategory(cat)}>
                    {cat.active ? 'Activa' : 'Inactiva'}
                  </button>
                  <button type="button" className={onlineButtonClass('ghost')} onClick={() => removeCategory(cat.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'filtros' ? (
        <div className="space-y-4">
          <form onSubmit={addFilter} className="flex flex-wrap gap-2">
            <input
              className={onlineFieldClass()}
              placeholder="Nuevo filtro (ej. Sin TACC)"
              value={newFilter}
              onChange={(e) => setNewFilter(e.target.value)}
            />
            <button type="submit" className={onlineButtonClass()}>
              Agregar
            </button>
          </form>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filters.map((f) => (
              <div key={f.id} className="rounded-xl border border-border bg-card p-3">
                <input
                  className={`${onlineFieldClass()} mb-2 font-medium`}
                  defaultValue={f.label}
                  onBlur={async (e) => {
                    if (e.target.value === f.label) return;
                    const token = getAccessToken();
                    if (!token || !e.target.value.trim()) return;
                    await onlineApi.filters.update(f.id, { label: e.target.value.trim() }, token);
                    await reload();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  slug: {f.slug} · {f._count?.productos ?? 0} productos
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className={onlineButtonClass('ghost')} onClick={() => toggleFilter(f)}>
                    {f.active ? 'Activo' : 'Inactivo'}
                  </button>
                  <button type="button" className={onlineButtonClass('ghost')} onClick={() => removeFilter(f.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button type="button" className={onlineButtonClass()} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancelar' : '+ Agregar al menú web'}
          </button>

          {showCreate && (
            <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-2">
              <SalesProductPicker
                products={salesProducts}
                alreadyOnWebIds={alreadyOnWebIds}
                value={draft.salesProductId}
                onSelect={applySalesProduct}
              />

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Precio web (promo)
                </label>
                <input
                  className={onlineFieldClass()}
                  placeholder="Precio"
                  type="number"
                  min={0}
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  required
                  disabled={!draft.salesProductId}
                />
                {draft.salesProductId && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Podés dejar el precio de ventas o bajarlo para una promo online.
                  </p>
                )}
              </div>

              <input
                className={onlineFieldClass()}
                placeholder="Nombre (opcional)"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                disabled={!draft.salesProductId}
              />
              <select
                className={onlineFieldClass()}
                value={draft.webCategoryId}
                onChange={(e) => setDraft({ ...draft, webCategoryId: e.target.value })}
                disabled={!draft.salesProductId}
              >
                <option value="">Sin categoría web</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                className={onlineFieldClass()}
                placeholder="Emoji"
                value={draft.emoji}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                disabled={!draft.salesProductId}
              />
              <div className="md:col-span-2">
                <OnlineMediaUpload
                  label="Imagen del producto"
                  value={draft.imagenWeb}
                  onChange={(url) => setDraft({ ...draft, imagenWeb: url })}
                />
              </div>
              <textarea
                className={`${onlineFieldClass()} md:col-span-2 min-h-[60px]`}
                placeholder="Descripción web"
                value={draft.descripcionWeb}
                onChange={(e) => setDraft({ ...draft, descripcionWeb: e.target.value })}
                disabled={!draft.salesProductId}
              />
              <div className="md:col-span-2 flex flex-wrap gap-2">
                {filters.map((f) => (
                  <label key={f.id} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.filterIds.includes(f.id)}
                      disabled={!draft.salesProductId}
                      onChange={(e) => {
                        setDraft({
                          ...draft,
                          filterIds: e.target.checked
                            ? [...draft.filterIds, f.id]
                            : draft.filterIds.filter((id) => id !== f.id),
                        });
                      }}
                    />
                    {f.label}
                  </label>
                ))}
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.popularWeb}
                    disabled={!draft.salesProductId}
                    onChange={(e) => setDraft({ ...draft, popularWeb: e.target.checked })}
                  />
                  Popular
                </label>
              </div>
              <button
                type="submit"
                disabled={savingId === 'new' || !draft.salesProductId}
                className={`${onlineButtonClass()} md:col-span-2`}
              >
                Publicar en menú web
              </button>
            </form>
          )}

          <div className="space-y-3">
            {rows.map((row) => {
              const filterIds = row.filtrosWeb?.map((f) => f.filtro.id) ?? [];
              return (
                <div key={row.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    {row.imagenWeb && (
                      <img src={row.imagenWeb} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{row.emoji} {row.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.webCategory?.name ?? row.category} · {row.kitchen?.name} · $
                            {Number(row.price).toLocaleString('es-AR')}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={savingId === row.id}
                          className={onlineButtonClass(row.visibleWeb ? 'ghost' : 'primary')}
                          onClick={() => saveProduct(row, { visibleWeb: !row.visibleWeb })}
                        >
                          {row.visibleWeb ? 'Visible en web' : 'Oculto'}
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <input
                          className={onlineFieldClass()}
                          defaultValue={row.name}
                          placeholder="Nombre"
                          onBlur={(e) => e.target.value !== row.name && saveProduct(row, { name: e.target.value })}
                        />
                        <input
                          className={onlineFieldClass()}
                          type="number"
                          defaultValue={String(row.price)}
                          onBlur={(e) =>
                            Number(e.target.value) !== Number(row.price) &&
                            saveProduct(row, { price: Number(e.target.value) })
                          }
                        />
                        <select
                          className={onlineFieldClass()}
                          defaultValue={row.kitchenId}
                          onChange={(e) => saveProduct(row, { kitchenId: e.target.value })}
                        >
                          {kitchens.map((k) => (
                            <option key={k.id} value={k.id}>{k.emoji} {k.name}</option>
                          ))}
                        </select>
                        <select
                          className={onlineFieldClass()}
                          defaultValue={row.webCategoryId ?? ''}
                          onChange={(e) => saveProduct(row, { webCategoryId: e.target.value || null })}
                        >
                          <option value="">Sin categoría web</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <div className="md:col-span-2">
                          <OnlineMediaUpload
                            value={row.imagenWeb ?? ''}
                            onChange={(url) => saveProduct(row, { imagenWeb: url || null })}
                          />
                        </div>
                        <textarea
                          className={`${onlineFieldClass()} md:col-span-2 min-h-[60px]`}
                          defaultValue={row.descripcionWeb ?? ''}
                          placeholder="Descripción web"
                          onBlur={(e) =>
                            e.target.value !== (row.descripcionWeb ?? '') &&
                            saveProduct(row, { descripcionWeb: e.target.value || null })
                          }
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {filters.map((f) => (
                          <label key={f.id} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              defaultChecked={filterIds.includes(f.id)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...filterIds, f.id]
                                  : filterIds.filter((id) => id !== f.id);
                                void saveProduct(row, { filterIds: next });
                              }}
                            />
                            {f.label}
                          </label>
                        ))}
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            defaultChecked={row.popularWeb}
                            onChange={(e) => saveProduct(row, { popularWeb: e.target.checked })}
                          />
                          Popular
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </OnlinePanelShell>
  );
}
