import { useMemo, useState } from "react";
import { computeSellableStock } from "@/features/sales/stock-link";
import { Plus, Edit2, Trash2, X, ChefHat } from "lucide-react";
import { ProductEmojiPicker } from "@/features/sales/components/ProductEmojiPicker";
import { RecipeIngredientsEditor } from "@/features/sales/components/RecipeIngredientsEditor";
import { SalesCategorySelect } from "@/features/sales/components/SalesCategorySelect";
import { getSalesCategoryEmoji, mergeSalesCategories } from "@/features/sales/lib/sales-categories";
import { Product, Station, stations } from "./mockData";
import { useStore } from "./VentasPosContext";

const stationStyle: Record<Station, string> = {
  Parrilla: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  Barra: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300",
  Cervecería: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  Cocina: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
};

export function ProductsModule() {
  const {
    products,
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

  const saveProduct = (p: Product) => {
    storeSave(p);
    setEditing(null);
    setCreating(false);
  };

  const deleteProduct = (id: string) => {
    if (confirm("¿Eliminar producto?")) storeDelete(id);
  };

  const blank: Product = {
    id: `p${Date.now()}`,
    name: "",
    price: 0,
    category: "Comidas",
    station: "Cocina",
    stock: 0,
    emoji: "🍽️",
    recipe: [],
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

      {tab === "cocinas" && <StationsTab products={products} />}

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
        {categoryList.map((cat) => {
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
                          <span className={`px-1.5 py-0.5 rounded ${stationStyle[p.station]}`}>
                            {p.station}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400">${p.price.toLocaleString()}</span>
                          <span className={p.stock < 10 ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}>
                            · disp. {p.stock}
                          </span>
                          {p.recipe && p.recipe.length > 0 && (
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
        })}
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

function StationsTab({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {stations.map((s) => {
        const list = products.filter((p) => p.station === s);
        return (
          <div key={s} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-0.5 rounded ${stationStyle[s]}`}>{s}</span>
              <span className="text-xs text-muted-foreground">{list.length} productos</span>
            </div>
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">Sin productos asignados</div>
            ) : (
              <ul className="space-y-1">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm text-foreground">
                    <span>{p.emoji}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.category}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
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
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const { addSalesCategory, salesCategoryEmojis, ingredients } = useStore();
  const [draft, setDraft] = useState<Product>({ ...product, recipe: product.recipe || [] });

  const calculatedStock = useMemo(() => {
    const availability = new Map(ingredients.map(i => [i.id, i.stock]));
    return computeSellableStock(
      (draft.recipe || []).map(r => ({ stockProductId: r.ingredientId, quantity: r.qty })),
      id => availability.get(id) ?? 0,
    );
  }, [draft.recipe, ingredients]);

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
                {(draft.recipe?.length ?? 0) > 0 ? calculatedStock : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Calculado según inventario y receta
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
                onChange={(e) => setDraft({ ...draft, station: e.target.value as Station })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
              >
                {stations.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-4">
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
          </div>
        </div>

        <div className="border-t border-border p-4 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-foreground">
            Cancelar
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
