import { useMemo, useState } from "react";
import { computeSellableStock, getMaxSellableUnits } from "@/features/sales/stock-link";
import { Plus, Edit2, Trash2, X, ChefHat, Tags } from "lucide-react";
import { ProductEmojiPicker } from "@/features/sales/components/ProductEmojiPicker";
import { RecipeIngredientsEditor } from "@/features/sales/components/RecipeIngredientsEditor";
import { PromoComponentsEditor } from "@/features/sales/components/PromoComponentsEditor";
import { SalesCategorySelect } from "@/features/sales/components/SalesCategorySelect";
import { getSalesCategoryEmoji, mergeSalesCategories } from "@/features/sales/lib/sales-categories";
import { Product } from "./mockData";
import { getStationStyle } from "./station-styles";
import { useStore } from "./VentasPosContext";

export function ProductsModule() {
  const {
    products,
    kitchens,
    salesCategories,
    salesCategoryEmojis,
    addSalesCategory,
    saveProduct: storeSave,
    deleteProduct: storeDelete,
  } = useStore();

  const categoryList = useMemo(
    () => mergeSalesCategories(salesCategories, products.map((p) => p.category)),
    [salesCategories, products],
  );
  const [tab, setTab] = useState<"productos" | "cocinas">("productos");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const saveProduct = async (p: Product) => {
    try {
      await storeSave(p);
      setEditing(null);
      setCreating(false);
    } catch {
      // El modal muestra el error; los datos ya quedaron en localStorage.
    }
  };

  const deleteProduct = (id: string) => {
    if (confirm("¿Eliminar producto?")) storeDelete(id);
  };

  const blank: Product = {
    id: `p${Date.now()}`,
    name: "",
    price: 0,
    category: "",
    station: kitchens[0]?.name ?? "",
    stock: 0,
    emoji: "🍽️",
    kind: "simple",
    recipe: [],
    bundle: [],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex bg-muted rounded-lg p-1 mb-4 w-fit overflow-x-auto max-w-full">
        {(["productos", "cocinas"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm whitespace-nowrap capitalize ${
              tab === t ? "bg-card shadow" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "cocinas" && <KitchensManager />}

      {tab === "productos" && (
      <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-foreground">Productos ({products.length})</h3>
        <button
          onClick={() => setCreating(true)}
          className="bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      <div className="space-y-5 pb-20">
        {categoryList.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2">
            No hay categorías todavía. Creá la primera al agregar un producto con &quot;+ Nueva categoría&quot;.
          </p>
        ) : (
        categoryList.map((cat) => {
          const list = products.filter((p) => p.category === cat);
          return (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{getSalesCategoryEmoji(cat, salesCategoryEmojis)}</span>
                <h4 className="text-foreground">{cat}</h4>
                <span className="text-xs text-muted-foreground">({list.length})</span>
              </div>
              {list.length === 0 ? (
                <div className="text-sm text-muted-foreground italic px-2">Sin productos</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {list.map((p) => (
                    <div
                      key={p.id}
                      className="bg-card rounded-xl border border-border p-3 flex items-center gap-3"
                    >
                      <span className="text-3xl">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-foreground truncate">{p.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded ${getStationStyle(p.station)}`}>
                            {p.station}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400">${p.price.toLocaleString()}</span>
                          <span className={p.stock < 10 ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}>
                            · disp. {p.stock}
                          </span>
                          {p.kind === 'promo' && p.bundle && p.bundle.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                              <Tags className="w-3 h-3" /> promo · {p.bundle.length}
                            </span>
                          )}
                          {p.kind !== 'promo' && p.recipe && p.recipe.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300">
                              <ChefHat className="w-3 h-3" /> {p.recipe.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditing(p)}
                        className="p-2 hover:bg-accent rounded"
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })
        )}
      </div>

      {(editing || creating) && (
        <ProductEditor
          product={editing || blank}
          categories={categoryList}
          isNew={creating}
          onSave={saveProduct}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
      </>
      )}
    </div>
  );
}

function KitchensManager() {
  const { kitchens, products, createKitchen, updateKitchen, deleteKitchen, setToast } = useStore();
  const [editing, setEditing] = useState<{ id: string; name: string; emoji: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const productCountByKitchen = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      counts.set(p.station, (counts.get(p.station) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setName("");
    setEmoji("🍽️");
  };

  const startEdit = (k: { id: string; name: string; emoji: string }) => {
    setEditing(k);
    setCreating(false);
    setName(k.name);
    setEmoji(k.emoji || "🍽️");
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setName("");
    setEmoji("🍽️");
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setToast("Ingresá un nombre para la cocina.");
      return;
    }
    try {
      if (editing) {
        await updateKitchen(editing.id, { name: trimmed, emoji });
      } else {
        await createKitchen({ name: trimmed, emoji });
      }
      closeForm();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "No se pudo guardar la cocina");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKitchen(id);
      setConfirmDelete(null);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "No se pudo eliminar la cocina");
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex justify-between items-center">
        <h3 className="text-foreground">Cocinas / Sectores ({kitchens.length})</h3>
        <button
          onClick={startCreate}
          className="bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Nueva
        </button>
      </div>

      {(creating || editing) && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ChefHat className="w-4 h-4 text-emerald-600" />
            {editing ? "Editar cocina" : "Nueva cocina"}
          </div>
          <div className="flex gap-2">
            <ProductEmojiPicker value={emoji} onChange={setEmoji} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la cocina..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
              className="min-w-0 flex-1 px-3 py-2 border border-border rounded-lg bg-input-background"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={closeForm} className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-lg">
              Cancelar
            </button>
            <button onClick={() => void handleSave()} className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              {editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </div>
      )}

      {kitchens.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">No hay cocinas. Creá la primera con &quot;Nueva&quot;.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {kitchens.map((k) => {
            const count = productCountByKitchen.get(k.name) ?? 0;
            return (
              <div key={k.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                <span className="text-2xl">{k.emoji || "🍽️"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-foreground truncate">{k.name}</div>
                  <div className="text-xs text-muted-foreground">{count} producto(s)</div>
                </div>
                <button
                  onClick={() => startEdit({ id: k.id, name: k.name, emoji: k.emoji || "🍽️" })}
                  className="p-2 hover:bg-accent rounded"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
                {confirmDelete === k.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void handleDelete(k.id)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                    >
                      Eliminar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(k.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductEditor({
  product,
  categories,
  isNew,
  onSave,
  onClose,
}: {
  product: Product;
  categories: string[];
  isNew: boolean;
  onSave: (p: Product) => Promise<void>;
  onClose: () => void;
}) {
  const { addSalesCategory, salesCategoryEmojis, ingredients, kitchens, products: menuProducts } = useStore();
  const [draft, setDraft] = useState<Product>({
    ...product,
    kind: product.kind ?? 'simple',
    recipe: product.recipe || [],
    bundle: product.bundle || [],
  });
  const [saveError, setSaveError] = useState('');

  const salesCatalog = useMemo(
    () => menuProducts.map(p => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      category: p.category,
      kind: p.kind ?? 'simple' as const,
      kitchenId: '',
      price: p.price,
      active: true,
      recipe: (p.recipe || []).map(r => ({ stockProductId: r.ingredientId, quantity: r.qty })),
      bundle: (p.bundle || []).map(b => ({ salesProductId: b.productId, quantity: b.qty })),
    })),
    [menuProducts],
  );

  const calculatedStock = useMemo(() => {
    if (draft.kind === 'promo') {
      return getMaxSellableUnits(
        {
          id: draft.id,
          name: draft.name,
          category: draft.category,
          kitchenId: '',
          price: draft.price,
          emoji: draft.emoji,
          kind: 'promo',
          active: true,
          recipe: [],
          bundle: (draft.bundle || []).map(b => ({ salesProductId: b.productId, quantity: b.qty })),
        },
        ingredients.map(i => ({
          id: i.id,
          name: i.name,
          code: '',
          description: '',
          category: '',
          unit: i.unit,
          image: '',
          stockByWarehouse: [{ warehouseId: 'w1', quantity: i.stock }],
        })),
        salesCatalog,
      );
    }
    const availability = new Map(ingredients.map(i => [i.id, i.stock]));
    return computeSellableStock(
      (draft.recipe || []).map(r => ({ stockProductId: r.ingredientId, quantity: r.qty })),
      id => availability.get(id) ?? 0,
    );
  }, [draft.kind, draft.recipe, draft.bundle, draft.id, draft.name, draft.category, draft.price, draft.emoji, ingredients, salesCatalog]);

  const promoProductOptions = useMemo(
    () => menuProducts
      .filter(p => p.id !== draft.id && p.kind !== 'promo')
      .map(p => ({ id: p.id, name: p.name, emoji: p.emoji, category: p.category })),
    [menuProducts, draft.id],
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-border">
          <h3>{isNew ? "Nuevo producto" : `Editar ${product.name}`}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm text-muted-foreground mb-1 block">Nombre</label>
              <div className="flex gap-2">
                <ProductEmojiPicker
                  value={draft.emoji}
                  onChange={(emoji) => setDraft({ ...draft, emoji })}
                />
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="min-w-0 flex-1 px-3 py-2 border border-border rounded-lg bg-input-background"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Precio</label>
              <input
                type="number"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: +e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Disponible</label>
              <div
                className={`w-full px-3 py-2 border border-border rounded-lg bg-muted ${
                  calculatedStock < 10 ? "text-red-600 dark:text-red-400" : "text-foreground"
                }`}
              >
                {(draft.kind === 'promo' ? (draft.bundle?.length ?? 0) > 0 : (draft.recipe?.length ?? 0) > 0)
                  ? calculatedStock
                  : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {draft.kind === 'promo'
                  ? 'Calculado según los productos incluidos'
                  : 'Calculado según inventario y receta'}
              </p>
            </div>
            <SalesCategorySelect
              value={draft.category}
              categories={categories}
              categoryEmojis={salesCategoryEmojis}
              onChange={(category, emojiOverride) => {
                setDraft((prev) => ({
                  ...prev,
                  category,
                  emoji: emojiOverride ?? getSalesCategoryEmoji(category, salesCategoryEmojis),
                }));
              }}
              onAddCategory={addSalesCategory}
            />
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Cocina / Sector</label>
              <select
                value={draft.station}
                onChange={(e) => setDraft({ ...draft, station: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
              >
                {kitchens.length === 0 && <option value="">Sin cocinas</option>}
                {kitchens.map((k) => (
                  <option key={k.id} value={k.name}>
                    {k.emoji ? `${k.emoji} ` : ""}{k.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Tipo de producto</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(prev => ({ ...prev, kind: 'simple', bundle: [] }))}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    draft.kind !== 'promo'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  Producto simple
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(prev => ({ ...prev, kind: 'promo', recipe: [] }))}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    draft.kind === 'promo'
                      ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  Promo compuesta
                </button>
              </div>
            </div>

            {draft.kind === 'promo' ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Tags className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <h4 className="text-foreground">Composición de la promo</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Elegí qué productos del menú incluye esta promo y en qué cantidad (ej. 2 vasos de fernet).
                </p>
                <PromoComponentsEditor
                  bundle={draft.bundle || []}
                  products={promoProductOptions}
                  excludeProductId={draft.id}
                  onChange={bundle => setDraft(prev => ({ ...prev, bundle }))}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <ChefHat className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-foreground">Receta — descuento de stock</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Productos del inventario que se descontarán al vender 1 unidad de este producto.
                </p>

                <RecipeIngredientsEditor
                  recipe={draft.recipe || []}
                  onChange={recipe => setDraft(prev => ({ ...prev, recipe }))}
                />
              </>
            )}
          </div>
        </div>

        <div className="border-t border-border p-4 flex flex-col gap-2 items-end">
          {saveError && <p className="text-sm text-red-600 dark:text-red-400 w-full">{saveError}</p>}
          <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-foreground">
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (!draft.name.trim()) {
                setSaveError('Ingresá un nombre para el producto.');
                return;
              }
              if (!draft.category.trim()) {
                setSaveError('Seleccioná o creá una categoría.');
                return;
              }
              if (draft.kind === 'promo' && (!draft.bundle || draft.bundle.length === 0)) {
                setSaveError('Agregá al menos un producto a la promo.');
                return;
              }
              setSaveError('');
              try {
                await onSave({
                  ...draft,
                  kind: draft.kind === 'promo' ? 'promo' : 'simple',
                });
              } catch (e) {
                setSaveError(e instanceof Error ? e.message : 'No se pudo guardar el producto');
              }
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
          >
            Guardar
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
