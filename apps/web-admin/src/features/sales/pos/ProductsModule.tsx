import { useState } from "react";
import { Plus, Edit2, Trash2, X, ChefHat } from "lucide-react";
import { Product, Ingredient, Station, stations } from "./mockData";
import { useStore } from "./VentasPosContext";

const stationStyle: Record<Station, string> = {
  Parrilla: "bg-orange-100 text-orange-700",
  Barra: "bg-sky-100 text-sky-700",
  Cervecería: "bg-amber-100 text-amber-700",
  Cocina: "bg-emerald-100 text-emerald-700",
};

const categoryEmoji: Record<string, string> = {
  Comidas: "🍔",
  Bebidas: "🥤",
  Snacks: "🍟",
  Postres: "🍦",
  Promos: "🎯",
};

export function ProductsModule() {
  const {
    products,
    saveProduct: storeSave,
    deleteProduct: storeDelete,
    ingredients,
  } = useStore();
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

  const blankIng: Ingredient = {
    id: `ing${Date.now()}`,
    name: "",
    unit: "u",
    stock: 0,
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex bg-gray-100 rounded-lg p-1 mb-4 w-fit overflow-x-auto max-w-full">
        {(["productos", "cocinas"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm whitespace-nowrap capitalize ${
              tab === t ? "bg-white shadow" : "text-gray-600"
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
        <h3 className="text-gray-900">Productos ({products.length})</h3>
        <button
          onClick={() => setCreating(true)}
          className="bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      <div className="space-y-5 pb-20">
        {(["Comidas", "Bebidas", "Snacks", "Postres", "Promos"] as const).map((cat) => {
          const list = products.filter((p) => p.category === cat);
          return (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{categoryEmoji[cat]}</span>
                <h4 className="text-gray-900">{cat}</h4>
                <span className="text-xs text-gray-500">({list.length})</span>
              </div>
              {list.length === 0 ? (
                <div className="text-sm text-gray-400 italic px-2">Sin productos</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {list.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3"
                    >
                      <span className="text-3xl">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-900 truncate">{p.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded ${stationStyle[p.station]}`}>
                            {p.station}
                          </span>
                          <span className="text-emerald-600">${p.price.toLocaleString()}</span>
                          <span className={p.stock < 10 ? "text-red-500" : "text-gray-500"}>
                            · stock {p.stock}
                          </span>
                          {p.recipe && p.recipe.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-700">
                              <ChefHat className="w-3 h-3" /> {p.recipe.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditing(p)}
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="p-2 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
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
          ingredients={ingredients}
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
          <div key={s} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-0.5 rounded ${stationStyle[s]}`}>{s}</span>
              <span className="text-xs text-gray-500">{list.length} productos</span>
            </div>
            {list.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Sin productos asignados</div>
            ) : (
              <ul className="space-y-1">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span>{p.emoji}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-gray-400">{p.category}</span>
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

function IngredientEditor({
  ingredient,
  isNew,
  onSave,
  onClose,
}: {
  ingredient: Ingredient;
  isNew: boolean;
  onSave: (i: Ingredient) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Ingredient>(ingredient);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3>{isNew ? "Nuevo insumo" : `Editar ${ingredient.name}`}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Nombre</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Unidad</label>
              <input
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                placeholder="u, g, ml..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Stock</label>
              <input
                type="number"
                value={draft.stock}
                onChange={(e) => setDraft({ ...draft, stock: +e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 p-3 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-700">
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

function ProductEditor({
  product,
  ingredients,
  isNew,
  onSave,
  onClose,
}: {
  product: Product;
  ingredients: Ingredient[];
  isNew: boolean;
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Product>({ ...product, recipe: product.recipe || [] });

  const addIngredient = (id: string) => {
    if (draft.recipe?.find((r) => r.ingredientId === id)) return;
    setDraft({ ...draft, recipe: [...(draft.recipe || []), { ingredientId: id, qty: 1 }] });
  };

  const updateQty = (id: string, qty: number) => {
    setDraft({
      ...draft,
      recipe: draft.recipe?.map((r) => (r.ingredientId === id ? { ...r, qty } : r)),
    });
  };

  const removeIng = (id: string) => {
    setDraft({ ...draft, recipe: draft.recipe?.filter((r) => r.ingredientId !== id) });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h3>{isNew ? "Nuevo producto" : `Editar ${product.name}`}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Nombre</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Emoji</label>
              <input
                value={draft.emoji}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Precio</label>
              <input
                type="number"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: +e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Stock</label>
              <input
                type="number"
                value={draft.stock}
                onChange={(e) => setDraft({ ...draft, stock: +e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Categoría</label>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as Product["category"] })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                <option>Comidas</option>
                <option>Bebidas</option>
                <option>Snacks</option>
                <option>Postres</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Cocina / Sector</label>
              <select
                value={draft.station}
                onChange={(e) => setDraft({ ...draft, station: e.target.value as Station })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                {stations.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="w-5 h-5 text-emerald-600" />
              <h4 className="text-gray-900">Receta — descuento de stock</h4>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Insumos que se descontarán automáticamente al vender 1 unidad.
            </p>

            <div className="space-y-2 mb-3">
              {draft.recipe?.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                  Sin receta. Agregá insumos abajo.
                </div>
              )}
              {draft.recipe?.map((r) => {
                const ing = ingredients.find((i) => i.id === r.ingredientId);
                if (!ing) return null;
                return (
                  <div
                    key={r.ingredientId}
                    className="flex items-center gap-2 bg-emerald-50 rounded-lg p-2"
                  >
                    <span className="flex-1 text-gray-900">
                      {ing.name}
                      <span className="text-xs text-gray-500 ml-2">
                        (stock: {ing.stock} {ing.unit})
                      </span>
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={r.qty}
                      onChange={(e) => updateQty(r.ingredientId, +e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-200 rounded bg-white"
                    />
                    <span className="text-sm text-gray-500 w-8">{ing.unit}</span>
                    <button onClick={() => removeIng(r.ingredientId)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Agregar insumo</label>
              <div className="flex flex-wrap gap-2">
                {ingredients
                  .filter((i) => !draft.recipe?.find((r) => r.ingredientId === i.id))
                  .map((i) => (
                    <button
                      key={i.id}
                      onClick={() => addIngredient(i.id)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-emerald-100 rounded-lg text-sm flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {i.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 p-4 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-700">
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
