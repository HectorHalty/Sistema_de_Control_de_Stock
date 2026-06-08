import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { getUnitLabel } from '@/app/components/store';
import { useStore } from '@/features/sales/pos/VentasPosContext';

export type RecipeLine = { ingredientId: string; qty: number };

type RecipeIngredientsEditorProps = {
  recipe: RecipeLine[];
  onChange: (recipe: RecipeLine[]) => void;
};

function defaultQty(unit: 'unidades' | 'kg') {
  return unit === 'kg' ? 0.1 : 1;
}

export function RecipeIngredientsEditor({ recipe, onChange }: RecipeIngredientsEditorProps) {
  const { ingredients } = useStore();
  const [search, setSearch] = useState('');

  const ingredientMap = useMemo(
    () => new Map(ingredients.map(i => [i.id, i])),
    [ingredients],
  );

  const inRecipe = useMemo(() => new Set(recipe.map(r => r.ingredientId)), [recipe]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingredients
      .filter(i => !inRecipe.has(i.id))
      .filter(i => !q || i.name.toLowerCase().includes(q));
  }, [ingredients, inRecipe, search]);

  const addIngredient = (id: string) => {
    const ing = ingredientMap.get(id);
    if (!ing || inRecipe.has(id)) return;
    onChange([...recipe, { ingredientId: id, qty: defaultQty(ing.unit) }]);
  };

  const updateQty = (id: string, raw: string) => {
    const ing = ingredientMap.get(id);
    const qty = ing?.unit === 'kg' ? parseFloat(raw) : parseInt(raw, 10);
    if (Number.isNaN(qty) || qty <= 0) return;
    onChange(recipe.map(r => (r.ingredientId === id ? { ...r, qty } : r)));
  };

  const removeIngredient = (id: string) => {
    onChange(recipe.filter(r => r.ingredientId !== id));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {recipe.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
            Sin receta. Buscá productos del inventario abajo.
          </div>
        )}
        {recipe.map(r => {
          const ing = ingredientMap.get(r.ingredientId);
          if (!ing) {
            return (
              <div
                key={r.ingredientId}
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800"
              >
                <span className="flex-1">Producto no encontrado en inventario</span>
                <button
                  type="button"
                  onClick={() => removeIngredient(r.ingredientId)}
                  className="text-red-500"
                  aria-label="Quitar insumo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          }

          const isKg = ing.unit === 'kg';
          return (
            <div
              key={r.ingredientId}
              className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2"
            >
              <span className="flex-1 min-w-0 truncate text-gray-900">{ing.name}</span>
              <input
                type="number"
                min={isKg ? 0.01 : 1}
                step={isKg ? 0.01 : 1}
                value={r.qty}
                onChange={e => updateQty(r.ingredientId, e.target.value)}
                className="w-20 px-2 py-1 border border-gray-200 rounded bg-white text-right"
                aria-label={`Cantidad de ${ing.name}`}
              />
              <span className="shrink-0 text-sm text-gray-500 w-10">
                {getUnitLabel(ing.unit, true)}
              </span>
              <button
                type="button"
                onClick={() => removeIngredient(r.ingredientId)}
                className="shrink-0 text-red-500"
                aria-label={`Quitar ${ing.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <label className="text-sm text-gray-600 mb-1 block">Inventario</label>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto del inventario..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white">
          {ingredients.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-gray-400">
              No hay productos en el inventario
            </p>
          ) : available.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-gray-400">
              {search.trim() ? 'Sin coincidencias' : 'Todos los productos ya están en la receta'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {available.map(i => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => addIngredient(i.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-emerald-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">{i.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
