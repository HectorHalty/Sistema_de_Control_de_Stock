import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';

export type PromoLine = { productId: string; qty: number };

type PromoProductOption = {
  id: string;
  name: string;
  emoji: string;
  category: string;
};

type PromoComponentsEditorProps = {
  bundle: PromoLine[];
  products: PromoProductOption[];
  excludeProductId?: string;
  onChange: (bundle: PromoLine[]) => void;
};

export function PromoComponentsEditor({
  bundle,
  products,
  excludeProductId,
  onChange,
}: PromoComponentsEditorProps) {
  const [search, setSearch] = useState('');

  const inBundle = useMemo(() => new Set(bundle.map(b => b.productId)), [bundle]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter(p => p.id !== excludeProductId)
      .filter(p => !inBundle.has(p.id))
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, excludeProductId, inBundle, search]);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const addProduct = (id: string) => {
    if (inBundle.has(id)) return;
    onChange([...bundle, { productId: id, qty: 1 }]);
  };

  const updateQty = (productId: string, qty: number) => {
    const next = Math.max(1, Math.floor(qty) || 1);
    onChange(bundle.map(b => (b.productId === productId ? { ...b, qty: next } : b)));
  };

  const removeProduct = (productId: string) => {
    onChange(bundle.filter(b => b.productId !== productId));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {bundle.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-lg">
            Agregá los productos que incluye esta promo (ej. 2× Vaso Fernet).
          </div>
        )}
        {bundle.map(line => {
          const product = productMap.get(line.productId);
          return (
            <div
              key={line.productId}
              className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2"
            >
              <span className="text-xl shrink-0">{product?.emoji || '🍽️'}</span>
              <span className="flex-1 min-w-0 truncate text-foreground">
                {product?.name || 'Producto no encontrado'}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={line.qty}
                onChange={e => updateQty(line.productId, Number(e.target.value))}
                className="w-16 px-2 py-1 border border-border rounded bg-input-background text-right"
                aria-label={`Cantidad de ${product?.name ?? 'producto'}`}
              />
              <span className="text-xs text-muted-foreground shrink-0">u.</span>
              <button
                type="button"
                onClick={() => removeProduct(line.productId)}
                className="shrink-0 text-red-500 dark:text-red-400"
                aria-label="Quitar producto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Productos del menú</label>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full rounded-lg border border-border bg-input-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card">
          {available.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {search.trim() ? 'Sin coincidencias' : 'No hay más productos para agregar'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {available.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span className="text-lg">{p.emoji || '🍽️'}</span>
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground truncate">{p.category}</span>
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
