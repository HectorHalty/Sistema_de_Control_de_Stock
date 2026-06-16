import type { Product, Category } from '@/app/components/store';
import { getUnitLabel } from '@/app/components/store';
import { previewNextProductCode } from '@/features/inventory/product-codes';
import { useState } from 'react';
import { useAppContext } from '@/app/providers/AppContext';
import { Plus, Search, Edit, Trash2, X, Package, ChevronDown } from 'lucide-react';
import { ExpandChevron } from '@/shared/components/ExpandChevron';
import { CategoryIconBadge } from '@/features/inventory/lib/category-icon-badge';
import { AVAILABLE_CATEGORY_ICON_NAMES, getCategoryIcon } from '@/features/inventory/lib/category-icons';

const AVAILABLE_ICON_NAMES = AVAILABLE_CATEGORY_ICON_NAMES;

export function ProductsPage() {
  const {
    products,
    warehouses,
    categories,
    getTotalStock,
    addAudit,
    addStockMovements,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
  } = useAppContext();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCatFilter, setShowCatFilter] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCat;
  }).sort((a, b) => a.category.localeCompare(b.category, 'es') || a.name.localeCompare(b.name, 'es'));

  const handleDelete = async (id: string) => {
    const product = products.find(p => p.id === id);
    try {
      await deleteProduct(id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo eliminar el producto');
      return;
    }
    addAudit({ user: 'Admin', action: 'Eliminación Producto', element: product?.name || '', previousValue: '-', newValue: '-' });
    setDeleteConfirm(null);
  };

  const handleSave = async (product: Product) => {
    if (editingProduct) {
      // Registrar ajustes manuales de stock por almacén para el libro de movimientos.
      const movements = warehouses
        .map(w => {
          const before = editingProduct.stockByWarehouse.find(s => s.warehouseId === w.id)?.quantity ?? 0;
          const after = product.stockByWarehouse.find(s => s.warehouseId === w.id)?.quantity ?? 0;
          return { warehouseId: w.id, delta: after - before };
        })
        .filter(m => m.delta !== 0)
        .map(m => ({
          type: 'ajuste_manual' as const,
          productId: product.id,
          warehouseId: m.warehouseId,
          quantity: m.delta,
          reference: 'Edición de producto',
          operatorId: 'Admin',
          operatorName: 'Admin',
        }));

      try {
        await updateProduct(product, editingProduct);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'No se pudo guardar el producto');
        return;
      }
      if (movements.length > 0) addStockMovements(movements);
      addAudit({ user: 'Admin', action: 'Edición Producto', element: product.name, previousValue: '-', newValue: '-' });
    } else {
      try {
        await createProduct(product);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'No se pudo crear el producto');
        return;
      }
      addAudit({ user: 'Admin', action: 'Alta Producto', element: product.name, previousValue: '-', newValue: '-' });
    }
    setShowModal(false);
    setEditingProduct(null);
  };

  const getCatIcon = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    if (!cat) return Package;
    return getCategoryIcon(cat.icon);
  };

  const getCatIconName = (categoryName: string) => {
    return categories.find(c => c.name === categoryName)?.icon ?? 'Package';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">{products.length} productos registrados</p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={18} />
          Nuevo Producto
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 outline-none"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCatFilter(!showCatFilter)}
            className="px-4 py-2.5 rounded-lg bg-card border border-border focus:border-[#3d7a3d] outline-none text-sm flex items-center gap-2 min-w-[200px] justify-between"
          >
            <span className="flex items-center gap-2">
              {categoryFilter ? (
                <>
                  {(() => { const Icon = getCatIcon(categoryFilter); return <Icon size={16} className="text-[#3d7a3d]" />; })()}
                  {categoryFilter}
                </>
              ) : (
                'Todas las categorías'
              )}
            </span>
            <ChevronDown size={16} className="text-muted-foreground" />
          </button>
          {showCatFilter && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCatFilter(false)} />
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setCategoryFilter(''); setShowCatFilter(false); }}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-muted transition-colors text-left ${!categoryFilter ? 'bg-[#3d7a3d]/10 text-[#3d7a3d]' : ''}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Package size={16} className="text-[#3d7a3d]" />
                  </div>
                  <span style={{ fontWeight: !categoryFilter ? 500 : 400 }}>Todas las categorías</span>
                </button>
                {categories.map(c => {
                  const CIcon = getCategoryIcon(c.icon);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCategoryFilter(c.name); setShowCatFilter(false); }}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-muted transition-colors text-left ${categoryFilter === c.name ? 'bg-[#3d7a3d]/10 text-[#3d7a3d]' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                        <CIcon size={16} className="text-[#3d7a3d]" />
                      </div>
                      <span style={{ fontWeight: categoryFilter === c.name ? 500 : 400 }}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="block sm:hidden space-y-2">
        {filtered.map(product => {
          const total = getTotalStock(product);
          const isExpanded = expandedProductId === product.id;
          return (
            <div key={product.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
              >
                <CategoryIconBadge iconName={getCatIconName(product.category)} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ fontWeight: 500 }}>{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.code}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm ${total < 20 ? 'text-red-600' : 'text-foreground'}`} style={{ fontWeight: 600 }}>
                    {total} {getUnitLabel(product.unit, true)}
                  </span>
                  <ExpandChevron expanded={isExpanded} />
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-border bg-muted/40 px-4 py-3">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Categoría</p>
                      <p className="text-sm" style={{ fontWeight: 500 }}>{product.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Unidad</p>
                      <p className="text-sm" style={{ fontWeight: 500 }}>{product.unit === 'kg' ? 'Kilogramos' : 'Unidades'}</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1.5">Stock por Almacén</p>
                    <div className="space-y-1">
                      {product.stockByWarehouse.map(s => {
                        const wh = warehouses.find(w => w.id === s.warehouseId);
                        return (
                          <div key={s.warehouseId} className="flex justify-between py-1.5 px-3 bg-card rounded-lg text-sm">
                            <span className="text-xs text-muted-foreground">{wh?.name || s.warehouseId}</span>
                            <span className="text-xs" style={{ fontWeight: 500 }}>{s.quantity} {getUnitLabel(product.unit, true)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingProduct(product); setShowModal(true); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 text-primary text-xs"
                    >
                      <Edit size={14} /> Editar
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(product.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs"
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">No se encontraron productos</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider">Producto</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider">Stock Total</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.flatMap(product => {
                const total = getTotalStock(product);
                const isExpanded = expandedProductId === product.id;
                const rows = [
                  <tr
                    key={product.id}
                    className={`border-b border-border/40 hover:bg-muted/50 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/50' : ''}`}
                    onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CategoryIconBadge iconName={getCatIconName(product.category)} size="md" />
                        <div className="min-w-0">
                          <span className="text-sm block" style={{ fontWeight: 500 }}>{product.name}</span>
                          <span className="text-xs text-muted-foreground">{product.code}</span>
                        </div>
                        <div className="ml-1 text-muted-foreground">
                          <ExpandChevron expanded={isExpanded} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm ${total < 20 ? 'text-red-600' : 'text-foreground'}`} style={{ fontWeight: 600 }}>
                        {total} {getUnitLabel(product.unit, true)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingProduct(product); setShowModal(true); }}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-600 transition-colors"
                          title="Modificar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(product.id); }}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ];
                if (isExpanded) {
                  rows.push(
                    <tr key={product.id + '-detail'}>
                      <td colSpan={3} className="p-0">
                        <div className="bg-muted/40 border-b border-border px-5 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Código</p>
                              <p className="text-sm" style={{ fontWeight: 500 }}>{product.code}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Categoría</p>
                              <span className="inline-flex items-center gap-1.5 text-sm mt-0.5">
                                {(() => { const Icon = getCatIcon(product.category); return <Icon size={14} className="text-[#3d7a3d]" />; })()}
                                {product.category}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Stock Total</p>
                              <p className="text-sm" style={{ fontWeight: 600 }}>{total} {getUnitLabel(product.unit, true)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Unidad de Medida</p>
                              <p className="text-sm" style={{ fontWeight: 500 }}>{product.unit === 'kg' ? 'Kilogramos' : 'Unidades'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Unidad de Pedido</p>
                              <p className="text-sm" style={{ fontWeight: 500 }}>{product.orderUnit ? `Pack x${product.orderUnit}` : 'Sin pack definido'}</p>
                            </div>
                          </div>
                          {product.description && (
                            <div className="mb-4">
                              <p className="text-xs text-muted-foreground">Descripción</p>
                              <p className="text-sm">{product.description}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Stock por Almacén</p>
                            <div className="space-y-1">
                              {product.stockByWarehouse.map(s => {
                                const wh = warehouses.find(w => w.id === s.warehouseId);
                                return (
                                  <div key={s.warehouseId} className="flex justify-between py-2 px-3 bg-card rounded-lg text-sm">
                                    <span>{wh?.name || s.warehouseId}</span>
                                    <span style={{ fontWeight: 500 }}>{s.quantity} {getUnitLabel(product.unit, true)}</span>
                                  </div>
                                );
                              })}
                              {product.stockByWarehouse.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-3">Sin stock asignado a almacenes</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No se encontraron productos</div>
        )}
      </div>

      {/* Product Form Modal */}
      {showModal && (
        <ProductFormModal
          product={editingProduct}
          allProducts={products}
          warehouses={warehouses}
          categories={categories}
          onAddCategory={(cat: Category) => {
            void createCategory({ name: cat.name, icon: cat.icon }).catch(e =>
              window.alert(e instanceof Error ? e.message : 'No se pudo crear la categoría'),
            );
          }}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingProduct(null); }}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)} title="Confirmar Eliminación">
          <p className="text-sm text-muted-foreground mb-4">¿Estás seguro de que querés eliminar este producto? Esta acción no se puede deshacer.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition-colors">
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function ProductFormModal({ product, allProducts, warehouses, categories, onAddCategory, onSave, onClose }: {
  product: Product | null;
  allProducts: Product[];
  warehouses: { id: string; name: string }[];
  categories: Category[];
  onAddCategory: (cat: Category) => void;
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Product>(
    product || {
      id: '', name: '', code: '', description: '', category: '', unit: 'unidades', image: '',
      stockByWarehouse: [],
    }
  );
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('Package');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const addWarehouseStock = () => {
    const available = warehouses.filter(w => !form.stockByWarehouse.find(s => s.warehouseId === w.id));
    if (available.length === 0) return;
    setForm(prev => ({
      ...prev,
      stockByWarehouse: [...prev.stockByWarehouse, { warehouseId: available[0].id, quantity: 0 }],
    }));
  };

  const removeWarehouseStock = (whId: string) => {
    setForm(prev => ({
      ...prev,
      stockByWarehouse: prev.stockByWarehouse.filter(s => s.warehouseId !== whId),
    }));
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCat: Category = {
      id: 'cat' + Date.now(),
      name: newCategoryName.trim(),
      icon: newCategoryIcon,
    };
    onAddCategory(newCat);
    setForm(prev => ({ ...prev, category: newCat.name }));
    setNewCategoryName('');
    setNewCategoryIcon('Package');
    setShowNewCategoryForm(false);
    setShowCategoryDropdown(false);
  };

  const SelectedCatIcon = getCategoryIcon(
    categories.find(c => c.name === form.category)?.icon || 'Package'
  );

  const NewCatIconComponent = getCategoryIcon(newCategoryIcon);

  const autoCode = product
    ? (form.category && form.category !== product.category
        ? previewNextProductCode(allProducts, form.category, product.id)
        : product.code)
    : previewNextProductCode(allProducts, form.category);

  return (
    <Modal onClose={onClose} title={product ? 'Editar Producto' : 'Nuevo Producto'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Nombre</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm text-foreground" />
          </div>
          <div>
            <label className="block text-sm mb-1">Código</label>
            <input
              value={autoCode}
              readOnly
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none text-sm text-muted-foreground cursor-default"
              title="Se asigna automáticamente al guardar"
            />
            <p className="text-xs text-muted-foreground mt-1">Asignado automáticamente por categoría</p>
          </div>
        </div>

        {/* Category selector with dropdown */}
        <div className="relative">
          <label className="block text-sm mb-1">Categoría</label>
          <button
            type="button"
            onClick={() => { setShowCategoryDropdown(!showCategoryDropdown); setShowNewCategoryForm(false); }}
            className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm text-left flex items-center justify-between text-foreground"
          >
            <span className="flex items-center gap-2">
              {form.category ? (
                <>
                  <SelectedCatIcon size={16} className="text-[#3d7a3d]" />
                  {form.category}
                </>
              ) : (
                <span className="text-muted-foreground">Seleccionar categoría...</span>
              )}
            </span>
            <ChevronDown size={16} className="text-muted-foreground" />
          </button>

          {showCategoryDropdown && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                {categories.map(cat => {
                  const CIcon = getCategoryIcon(cat.icon);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, category: cat.name }));
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full px-3 py-2.5 flex items-center gap-2.5 text-sm hover:bg-muted transition-colors text-left text-foreground ${form.category === cat.name ? 'bg-[#3d7a3d]/10 text-[#3d7a3d]' : ''}`}
                    >
                      <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center">
                        <CIcon size={14} className="text-[#3d7a3d]" />
                      </div>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewCategoryForm(true)}
                  className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-[#3d7a3d] hover:bg-muted transition-colors"
                >
                  <Plus size={16} />
                  Crear nueva categoría
                </button>
              </div>

              {showNewCategoryForm && (
                <div className="border-t border-border p-3 space-y-3 bg-muted">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(!showIconPicker)}
                      className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center hover:border-[#3d7a3d] transition-colors flex-shrink-0"
                    >
                      <NewCatIconComponent size={18} className="text-[#3d7a3d]" />
                    </button>
                    <input
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="Nombre de la categoría"
                      className="flex-1 px-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm text-foreground"
                      autoFocus
                    />
                  </div>

                  {showIconPicker && (
                    <div className="grid grid-cols-7 gap-1 p-2 bg-card rounded-lg border border-border">
                      {AVAILABLE_ICON_NAMES.map(name => {
                        const IconComp = getCategoryIcon(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => { setNewCategoryIcon(name); setShowIconPicker(false); }}
                            className={`p-2 rounded-md hover:bg-muted transition-colors ${newCategoryIcon === name ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
                            title={name}
                          >
                            <IconComp size={16} className={newCategoryIcon === name ? 'text-primary' : 'text-muted-foreground'} />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowNewCategoryForm(false); setNewCategoryName(''); }}
                      className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="px-3 py-1.5 rounded-lg text-xs bg-[#3d7a3d] text-white hover:bg-[#2f5f2f] transition-colors"
                    >
                      Crear
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Unit selector */}
        <div>
          <label className="block text-sm mb-1">Unidad de Medida</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, unit: 'unidades' }))}
              className={`p-3 rounded-lg border-2 text-left transition-all ${form.unit === 'unidades' ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <p className="text-sm" style={{ fontWeight: 500 }}>Unidades</p>
              <p className="text-xs text-muted-foreground mt-0.5">Productos individuales</p>
            </button>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, unit: 'kg' }))}
              className={`p-3 rounded-lg border-2 text-left transition-all ${form.unit === 'kg' ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <p className="text-sm" style={{ fontWeight: 500 }}>Kilogramos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Productos a granel / peso</p>
            </button>
          </div>
        </div>

        {/* Order unit (pack size) */}
        <div>
          <label className="block text-sm mb-1">Unidad de Pedido (pack)</label>
          <p className="text-xs text-muted-foreground mb-2">Cantidad en que se pide al proveedor (ej: 24 = packs de 24). Los pedidos se redondean a multiplos.</p>
          <input
            type="number"
            value={form.orderUnit || ''}
            onChange={e => {
              const val = parseInt(e.target.value);
              setForm(p => ({ ...p, orderUnit: val > 0 ? val : undefined }));
            }}
            className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm text-foreground"
            min={1}
            placeholder="Dejar vacio si no aplica"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Descripción</label>
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm resize-none text-foreground" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm">Stock por Almacén</label>
            <button type="button" onClick={addWarehouseStock} className="text-xs text-[#3d7a3d] hover:underline">
              + Agregar ubicación
            </button>
          </div>
          <div className="space-y-2">
            {form.stockByWarehouse.map((s, idx) => (
              <div key={s.warehouseId} className="flex items-center gap-2">
                <select
                  value={s.warehouseId}
                  onChange={e => {
                    const newStock = [...form.stockByWarehouse];
                    newStock[idx] = { ...newStock[idx], warehouseId: e.target.value };
                    setForm(p => ({ ...p, stockByWarehouse: newStock }));
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-input-background border border-border outline-none text-sm text-foreground"
                >
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <input
                  type="number"
                  value={s.quantity}
                  onChange={e => {
                    const newStock = [...form.stockByWarehouse];
                    newStock[idx] = { ...newStock[idx], quantity: parseInt(e.target.value) || 0 };
                    setForm(p => ({ ...p, stockByWarehouse: newStock }));
                  }}
                  className="w-24 px-3 py-2 rounded-lg bg-input-background border border-border outline-none text-sm text-right text-foreground"
                  min={0}
                />
                <button type="button" onClick={() => removeWarehouseStock(s.warehouseId)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted text-foreground">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => form.name && form.category && onSave(form)}
            className="px-4 py-2 rounded-lg bg-[#3d7a3d] text-white text-sm hover:bg-[#2f5f2f] transition-colors"
          >
            {product ? 'Guardar Cambios' : 'Crear Producto'}
          </button>
        </div>
      </div>
    </Modal>
  );
}