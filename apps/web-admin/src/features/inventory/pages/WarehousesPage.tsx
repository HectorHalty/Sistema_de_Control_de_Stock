import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/app/providers/AppContext';
import { getUnitLabel } from '@/app/components/store';
import type { Product } from '@/app/components/store';
import { getCategoryIcon } from '@/features/inventory/lib/category-icons';
import { Plus, Edit, Trash2, X, Warehouse, Package, ChevronDown, ChevronUp, Beer, Coffee, UtensilsCrossed, Refrigerator, Archive, ShoppingCart, Flame, Sandwich, Box, Star, Zap, Droplets, Search } from 'lucide-react';
import type { Warehouse as WarehouseType, Category } from '@/app/components/store';

const WAREHOUSE_ICONS: Record<string, React.ComponentType<any>> = {
  Warehouse, Package, Beer, Coffee, UtensilsCrossed, Refrigerator,
  Archive, ShoppingCart, Flame, Sandwich, Box, Star, Zap, Droplets,
};

function getWarehouseIcon(iconName?: string): React.ComponentType<any> {
  return (iconName && WAREHOUSE_ICONS[iconName]) ? WAREHOUSE_ICONS[iconName] : Warehouse;
}

export function WarehousesPage() {
  const { warehouses, setWarehouses, products, categories, getWarehouseTotalProducts, addAudit } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WarehouseType | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCatFilter, setShowCatFilter] = useState(false);

  useEffect(() => {
    setProductSearch('');
    setCategoryFilter('');
    setShowCatFilter(false);
  }, [expandedId]);

  const handleSave = (wh: WarehouseType) => {
    if (editing) {
      setWarehouses(prev => prev.map(w => w.id === wh.id ? wh : w));
      addAudit({ user: 'Admin', action: 'Edición Almacén', element: wh.name });
    } else {
      setWarehouses(prev => [...prev, { ...wh, id: `w${Date.now()}` }]);
      addAudit({ user: 'Admin', action: 'Alta Almacén', element: wh.name });
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    const wh = warehouses.find(w => w.id === id);
    setWarehouses(prev => prev.filter(w => w.id !== id));
    addAudit({ user: 'Admin', action: 'Eliminación Almacén', element: wh?.name || '' });
    setDeleteConfirm(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const expandedWarehouse = expandedId ? warehouses.find(w => w.id === expandedId) : null;
  const otherWarehouses = expandedId ? warehouses.filter(w => w.id !== expandedId) : [];

  const renderWarehouseCard = (wh: WarehouseType, expanded: boolean) => {
    const totalUnits = getWarehouseTotalProducts(wh.id);
    const warehouseProducts = products.filter(p => p.stockByWarehouse.some(s => s.warehouseId === wh.id));

    return (
      <div
        key={wh.id}
        className={`bg-card rounded-xl border shadow-sm overflow-hidden transition-all ${
          expanded ? 'border-[#3d7a3d]/50 shadow-md' : 'border-border'
        }`}
      >
        <div
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${expanded ? 'p-5' : 'p-4'}`}
          onClick={() => toggleExpand(wh.id)}
        >
          <div className={`flex items-start justify-between ${expanded ? 'mb-3' : ''}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-[#3d7a3d]/10 p-2.5 rounded-lg flex-shrink-0">
                {(() => {
                  const Icon = getWarehouseIcon(wh.icon);
                  return <Icon size={expanded ? 22 : 18} className="text-[#3d7a3d]" />;
                })()}
              </div>
              <div className="min-w-0">
                <h3 className={expanded ? '' : 'text-sm'}>{wh.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{wh.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setEditing(wh); setShowModal(true); }}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setDeleteConfirm(wh.id); }}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
              <div className="p-2 text-muted-foreground">
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-4 text-sm ${expanded ? 'mt-1' : 'mt-2'}`}>
            <span className="text-muted-foreground">
              <span style={{ fontWeight: 600 }} className="text-foreground">{warehouseProducts.length}</span> producto(s)
            </span>
            <span className="text-muted-foreground">
              <span style={{ fontWeight: 600 }} className="text-foreground">{totalUnits}</span> unidades
            </span>
          </div>
        </div>

        {expanded && (
          <WarehouseProductsPanel
            warehouseId={wh.id}
            products={warehouseProducts}
            categories={categories}
            productSearch={productSearch}
            setProductSearch={setProductSearch}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            showCatFilter={showCatFilter}
            setShowCatFilter={setShowCatFilter}
            fullWidth
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Almacenes</h1>
          <p className="text-sm text-muted-foreground mt-1">{warehouses.length} almacenes registrados</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={18} />
          Nuevo Almacén
        </button>
      </div>

      {!expandedId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map(wh => renderWarehouseCard(wh, false))}
        </div>
      )}

      {expandedWarehouse && (
        <div className="flex flex-col gap-4">
          {renderWarehouseCard(expandedWarehouse, true)}

          {otherWarehouses.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground px-1">Otros almacenes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {otherWarehouses.map(wh => renderWarehouseCard(wh, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); setEditing(null); }}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3>{editing ? 'Editar Almacén' : 'Nuevo Almacén'}</h3>
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <WarehouseForm initial={editing} onSave={handleSave} onCancel={() => { setShowModal(false); setEditing(null); }} />
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2">Confirmar Eliminación</h3>
            <p className="text-sm text-muted-foreground mb-4">¿Estás seguro? Los productos en este almacén perderán esta ubicación.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WarehouseProductsPanel({
  warehouseId,
  products,
  categories,
  productSearch,
  setProductSearch,
  categoryFilter,
  setCategoryFilter,
  showCatFilter,
  setShowCatFilter,
  fullWidth = false,
}: {
  warehouseId: string;
  products: Product[];
  categories: Category[];
  productSearch: string;
  setProductSearch: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  showCatFilter: boolean;
  setShowCatFilter: (v: boolean) => void;
  fullWidth?: boolean;
}) {
  const categoriesInWarehouse = useMemo(() => {
    const names = new Set(products.map(p => p.category));
    return categories.filter(c => names.has(c.name));
  }, [products, categories]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products
      .filter(p => {
        const matchSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q);
        const matchCat = !categoryFilter || p.category === categoryFilter;
        return matchSearch && matchCat;
      })
      .sort((a, b) => a.category.localeCompare(b.category, 'es') || a.name.localeCompare(b.name, 'es'));
  }, [products, productSearch, categoryFilter]);

  const getCatIcon = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    return getCategoryIcon(cat?.icon || 'Package');
  };

  return (
    <div className="border-t border-border bg-muted/40">
      <div className="px-5 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>
            Productos en este almacén
          </p>
          <span className="text-xs text-muted-foreground">
            {filteredProducts.length} de {products.length}
          </span>
        </div>

        {products.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="Buscar por nombre o código..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20"
              />
            </div>
            <div className="relative sm:w-[200px]">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setShowCatFilter(!showCatFilter);
                }}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm flex items-center gap-2 justify-between"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {categoryFilter ? (
                    <>
                      {(() => {
                        const Icon = getCatIcon(categoryFilter);
                        return <Icon size={14} className="text-[#3d7a3d] flex-shrink-0" />;
                      })()}
                      <span className="truncate">{categoryFilter}</span>
                    </>
                  ) : (
                    'Todas las categorías'
                  )}
                </span>
                <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
              </button>
              {showCatFilter && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCatFilter(false)} />
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setCategoryFilter('');
                        setShowCatFilter(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-muted text-left ${!categoryFilter ? 'bg-[#3d7a3d]/10 text-[#3d7a3d]' : ''}`}
                    >
                      <Package size={14} className="text-[#3d7a3d]" />
                      Todas las categorías
                    </button>
                    {categoriesInWarehouse.map(c => {
                      const CIcon = getCategoryIcon(c.icon);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setCategoryFilter(c.name);
                            setShowCatFilter(false);
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-muted text-left ${categoryFilter === c.name ? 'bg-[#3d7a3d]/10 text-[#3d7a3d]' : ''}`}
                        >
                          <CIcon size={14} className="text-[#3d7a3d]" />
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div
          className={`space-y-1.5 overflow-y-auto ${
            fullWidth ? 'max-h-[min(480px,55vh)]' : 'max-h-[min(320px,40vh)]'
          }`}
        >
          {filteredProducts.map(p => {
            const stock = p.stockByWarehouse.find(s => s.warehouseId === warehouseId);
            const CatIcon = getCatIcon(p.category);
            return (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-card rounded-lg gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CatIcon size={14} className="text-[#3d7a3d] flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm block truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.code} · {p.category}</span>
                  </div>
                </div>
                <span className="text-sm flex-shrink-0" style={{ fontWeight: 500 }}>
                  {stock?.quantity || 0} {getUnitLabel(p.unit, true)}
                </span>
              </div>
            );
          })}
          {products.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin productos en este almacén</p>
          )}
          {products.length > 0 && filteredProducts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No hay productos con esos filtros</p>
          )}
        </div>
      </div>
    </div>
  );
}

function WarehouseForm({ initial, onSave, onCancel }: { initial: WarehouseType | null; onSave: (w: WarehouseType) => void; onCancel: () => void }) {
  const [form, setForm] = useState<WarehouseType>(initial || { id: '', name: '', location: '', icon: 'Warehouse' });

  return (
    <div className="px-6 py-4 space-y-4">
      <div>
        <label className="block text-sm mb-1">Nombre</label>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-primary outline-none text-sm" />
      </div>
      <div>
        <label className="block text-sm mb-1">Ubicación</label>
        <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-primary outline-none text-sm" />
      </div>
      <div>
        <label className="block text-sm mb-2">Ícono</label>
        <div className="grid grid-cols-7 gap-2">
          {Object.entries(WAREHOUSE_ICONS).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              onClick={() => setForm(p => ({ ...p, icon: name }))}
              className={`p-2 rounded-lg flex items-center justify-center transition-colors ${form.icon === name ? 'bg-[#3d7a3d] text-white' : 'bg-muted hover:bg-muted/80 text-foreground'}`}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm">Cancelar</button>
        <button onClick={() => form.name && onSave(form)} className="px-4 py-2 rounded-lg bg-[#3d7a3d] text-white text-sm hover:bg-[#2f5f2f]">
          {initial ? 'Guardar' : 'Crear'}
        </button>
      </div>
    </div>
  );
}