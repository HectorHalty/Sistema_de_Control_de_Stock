import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { getUnitLabel } from '@/app/components/store';
import { useStore } from '@/features/sales/pos/VentasPosContext';
import {
  formatQuantityInput,
  isPartialQuantityInput,
  parseQuantityInput,
} from '@/features/sales/lib/parse-quantity';

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
  const [qtyInput, setQtyInput] = useState<Record<string, string>>({});

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
    if (!isPartialQuantityInput(raw)) return;
    setQtyInput(prev => ({ ...prev, [id]: raw }));
    const qty = parseQuantityInput(raw);
    if (qty === null || qty <= 0) return;
    onChange(recipe.map(r => (r.ingredientId === id ? { ...r, qty } : r)));
  };

  const commitQty = (id: string, qty: number) => {
    setQtyInput(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    onChange(recipe.map(r => (r.ingredientId === id ? { ...r, qty } : r)));
  };

  const removeIngredient = (id: string) => {
    setQtyInput(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    onChange(recipe.filter(r => r.ingredientId !== id));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {recipe.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-lg">
            Sin receta. Buscá productos del inventario abajo.
          </div>
        )}
        {recipe.map(r => {
          const ing = ingredientMap.get(r.ingredientId);
          if (!ing) {
            return (
              <div
                key={r.ingredientId}
                className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-2 text-sm text-amber-800 dark:text-amber-300"
              >
                <span className="flex-1">Producto no encontrado en inventario</span>
                <button
                  type="button"
                  onClick={() => removeIngredient(r.ingredientId)}
                  className="text-red-500 dark:text-red-400"
                  aria-label="Quitar insumo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          }

          const displayQty = qtyInput[r.ingredientId] ?? formatQuantityInput(r.qty);

          return (
            <div
              key={r.ingredientId}
              className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2"
            >
              <span className="flex-1 min-w-0 truncate text-foreground">{ing.name}</span>
              <input
                type="text"
                inputMode="decimal"
                value={displayQty}
                onChange={e => updateQty(r.ingredientId, e.target.value)}
                onBlur={() => {
                  const parsed = parseQuantityInput(displayQty);
                  if (parsed !== null && parsed > 0) {
                    commitQty(r.ingredientId, parsed);
                  } else {
                    setQtyInput(prev => {
                      const next = { ...prev };
                      delete next[r.ingredientId];
                      return next;
                    });
                  }
                }}
                placeholder="0,1"
                className="w-20 px-2 py-1 border border-border rounded bg-input-background text-right"
                aria-label={`Cantidad de ${ing.name}`}
              />
              <span className="shrink-0 text-sm text-muted-foreground w-10">
                {getUnitLabel(ing.unit, true)}
              </span>
              <button
                type="button"
                onClick={() => removeIngredient(r.ingredientId)}
                className="shrink-0 text-red-500 dark:text-red-400"
                aria-label={`Quitar ${ing.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Podés usar decimales con coma (ej. 0,1 = un décimo del producto por venta).
      </p>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Inventario</label>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto del inventario..."
            className="w-full rounded-lg border border-border bg-input-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card">
          {ingredients.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No hay productos en el inventario
            </p>
          ) : available.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {search.trim() ? 'Sin coincidencias' : 'Todos los productos ya están en la receta'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {available.map(i => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => addIngredient(i.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
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
