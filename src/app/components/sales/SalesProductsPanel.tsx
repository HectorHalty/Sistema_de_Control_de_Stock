import { useMemo, useState } from 'react';
import { ChefHat, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Kitchen, Product, SalesProduct } from '../store';
import { getMaxSellableUnits, getTotalStockQuantity } from './stock-link';

type ProductsSubTab = 'productos' | 'cocinas';

interface SalesProductsPanelProps {
  salesProducts: SalesProduct[];
  setSalesProducts: React.Dispatch<React.SetStateAction<SalesProduct[]>>;
  stockProducts: Product[];
  kitchens: Kitchen[];
  setKitchens: React.Dispatch<React.SetStateAction<Kitchen[]>>;
  apiOnline: boolean | null;
  onNotify: (message: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Comidas: '🍔',
  Bebidas: '🥤',
  Snacks: '🍟',
  Promos: '🎯',
  Postres: '🍦',
  General: '📦',
};

const KITCHEN_BADGE_CLASS: Record<string, string> = {
  Parrilla: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  Cocina: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  Barra: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  Cervecería: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
};

const KITCHEN_HEADER_CLASS: Record<string, string> = {
  Parrilla: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  Cocina: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  Barra: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  Cervecería: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

function formatHeaderDate(): string {
  const raw = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function kitchenBadgeClass(name: string): string {
  return KITCHEN_BADGE_CLASS[name] ?? 'bg-muted text-muted-foreground';
}

function kitchenHeaderClass(name: string): string {
  return KITCHEN_HEADER_CLASS[name] ?? 'bg-muted text-muted-foreground';
}

export function SalesProductsPanel({
  salesProducts,
  setSalesProducts,
  stockProducts,
  kitchens,
  setKitchens,
  apiOnline,
  onNotify,
}: SalesProductsPanelProps) {
  const [subTab, setSubTab] = useState<ProductsSubTab>('productos');

  const activeSalesProducts = useMemo(
    () => salesProducts.filter(p => p.active),
    [salesProducts],
  );

  const productsByCategory = useMemo(() => {
    const groups = new Map<string, SalesProduct[]>();
    activeSalesProducts.forEach(product => {
      const key = product.category || 'General';
      const list = groups.get(key) ?? [];
      list.push(product);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [activeSalesProducts]);

  const productsByKitchen = useMemo(() => {
    return kitchens
      .filter(k => k.active)
      .map(kitchen => ({
        kitchen,
        products: activeSalesProducts.filter(p => p.kitchenId === kitchen.id),
      }));
  }, [activeSalesProducts, kitchens]);

  const handleNewProduct = () => {
    const name = prompt('Nombre del producto:');
    if (!name?.trim()) return;
    if (stockProducts.length === 0) {
      onNotify('Creá productos en el módulo Stock antes de agregar productos de venta.');
      return;
    }
    const price = parseInt(prompt('Precio:') || '0', 10);
    const emoji = prompt('Emoji:') || '🍽️';
    const category = prompt('Categoría (Comidas, Bebidas, Snacks, Promos):', 'Comidas')?.trim() || 'Comidas';
    const kitchenList = kitchens.filter(k => k.active).map((k, i) => `${i + 1}. ${k.name}`).join('\n');
    const kitchenPick = parseInt(prompt(`Cocina / estación:\n${kitchenList}`, '1') || '1', 10) - 1;
    const kitchenId = kitchens.filter(k => k.active)[kitchenPick]?.id ?? kitchens[0]?.id ?? '';
    const stockOptions = stockProducts
      .map((p, index) => `${index + 1}. ${p.name} (stock: ${getTotalStockQuantity(p)})`)
      .join('\n');
    const pick = prompt(`Ingrediente de stock (número):\n${stockOptions}`);
    const pickIndex = parseInt(pick || '', 10) - 1;
    if (Number.isNaN(pickIndex) || pickIndex < 0 || pickIndex >= stockProducts.length) {
      onNotify('Producto no creado: debés vincular un producto de stock.');
      return;
    }
    const stockProduct = stockProducts[pickIndex];
    const recipeQty = Math.max(1, parseInt(prompt(`Cantidad de "${stockProduct.name}" por unidad vendida:`, '1') || '1', 10));
    setSalesProducts(prev => [...prev, {
      id: `sp-${Date.now()}`,
      name: name.trim(),
      category,
      kitchenId,
      price,
      emoji,
      recipe: [{ stockProductId: stockProduct.id, quantity: recipeQty }],
      active: true,
    }]);
    onNotify(`Producto "${name.trim()}" creado.`);
  };

  const handleEditProduct = (product: SalesProduct) => {
    const name = prompt('Nombre:', product.name);
    if (name === null) return;
    const price = parseInt(prompt('Precio:', String(product.price)) || String(product.price), 10);
    const emoji = prompt('Emoji:', product.emoji) ?? product.emoji;
    const category = prompt('Categoría:', product.category) ?? product.category;
    const recipeStr = prompt(
      'Receta (stockProductId:cantidad, separado por comas):',
      product.recipe.map(r => `${r.stockProductId}:${r.quantity}`).join(', '),
    );
    const recipe = recipeStr === null
      ? product.recipe
      : recipeStr.split(',').filter(Boolean).map(pair => {
          const [stockProductId, quantity] = pair.split(':');
          return { stockProductId: stockProductId.trim(), quantity: parseInt(quantity, 10) || 1 };
        });

    setSalesProducts(prev => prev.map(p => p.id === product.id
      ? { ...p, name: name.trim() || p.name, price, emoji, category, recipe }
      : p));
    onNotify(`Producto "${name.trim()}" actualizado.`);
  };

  const handleDeleteProduct = (product: SalesProduct) => {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    setSalesProducts(prev => prev.filter(p => p.id !== product.id));
    onNotify(`Producto "${product.name}" eliminado.`);
  };

  const handleNewKitchen = () => {
    const name = prompt('Nombre de la nueva cocina / estación:');
    if (!name?.trim()) return;
    const emoji = prompt('Emoji (ej: 🔥):') || '🍽️';
    setKitchens(prev => [...prev, { id: `k-${Date.now()}`, name: name.trim(), emoji, active: true }]);
    onNotify(`Cocina "${name.trim()}" creada.`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl text-foreground" style={{ fontWeight: 700 }}>Productos</h2>
          <p className="text-sm text-muted-foreground">{formatHeaderDate()}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
            apiOnline === false
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
          }`}
          style={{ fontWeight: 600 }}
        >
          <span className={`h-2 w-2 rounded-full ${apiOnline === false ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {apiOnline === false ? 'Sin conexión' : 'En línea'}
        </span>
      </div>

      <div className="flex rounded-2xl bg-muted/80 p-1">
        {([
          { id: 'productos' as const, label: 'Productos' },
          { id: 'cocinas' as const, label: 'Cocinas' },
        ]).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm transition-all ${
              subTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            style={{ fontWeight: subTab === tab.id ? 600 : 500 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'productos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Productos <span className="text-foreground" style={{ fontWeight: 600 }}>({activeSalesProducts.length})</span>
            </p>
            <button
              type="button"
              onClick={handleNewProduct}
              className="inline-flex items-center gap-1 rounded-xl bg-[#3d7a3d] px-4 py-2 text-sm text-white transition-colors hover:bg-[#2f5f2f]"
              style={{ fontWeight: 600 }}
            >
              <Plus size={16} /> Nuevo
            </button>
          </div>

          {productsByCategory.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No hay productos de venta. Creá el primero con &quot;Nuevo&quot;.
            </p>
          )}

          {productsByCategory.map(([category, items]) => (
            <section key={category} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-lg">{CATEGORY_ICONS[category] ?? '📦'}</span>
                <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                  {category} ({items.length})
                </h3>
              </div>
              <div className="space-y-2">
                {items.map(product => {
                  const kitchen = kitchens.find(k => k.id === product.kitchenId);
                  const kitchenName = kitchen?.name ?? 'Sin cocina';
                  const stockUnits = getMaxSellableUnits(product, stockProducts);
                  const showKitchenMeta = category === 'Comidas';

                  return (
                    <article
                      key={product.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
                    >
                      <span className="text-2xl">{product.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground" style={{ fontWeight: 600 }}>{product.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`rounded-md px-2 py-0.5 text-xs ${kitchenBadgeClass(kitchenName)}`} style={{ fontWeight: 600 }}>
                            {kitchenName}
                          </span>
                          <span className="text-sm text-[#3d7a3d]" style={{ fontWeight: 600 }}>{formatCurrency(product.price)}</span>
                          <span className="text-xs text-muted-foreground">stock {stockUnits}</span>
                          {showKitchenMeta && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                              <ChefHat size={12} />
                              {product.recipe.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditProduct(product)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`Editar ${product.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                          aria-label={`Eliminar ${product.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {subTab === 'cocinas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleNewKitchen}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <Plus size={14} /> Nueva cocina
            </button>
          </div>

          {productsByKitchen.map(({ kitchen, products: kitchenProducts }) => (
            <section
              key={kitchen.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className={`rounded-md px-2.5 py-1 text-xs ${kitchenHeaderClass(kitchen.name)}`} style={{ fontWeight: 600 }}>
                  {kitchen.emoji} {kitchen.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {kitchenProducts.length} producto{kitchenProducts.length === 1 ? '' : 's'}
                </span>
              </div>
              {kitchenProducts.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">Sin productos asignados</p>
              ) : (
                <ul className="divide-y divide-border">
                  {kitchenProducts.map(product => (
                    <li key={product.id} className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <span>{product.emoji}</span>
                        {product.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{product.category}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
