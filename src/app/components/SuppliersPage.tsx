import { useState } from 'react';
import { useAppContext } from './AppContext';
import { Plus, X, Pencil, Trash2, Phone, Package, Search, ChevronDown, ChevronUp, Check } from 'lucide-react';
import type { Supplier } from './store';

type ViewMode = 'list' | 'create' | 'edit';

export function SuppliersPage() {
  const ctx = useAppContext();
  const { suppliers, setSuppliers, products, addAudit } = ctx;

  const [view, setView] = useState<ViewMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setFormName('');
    setFormPhone('');
    setFormProductIds([]);
    setProductSearch('');
  };

  const openCreate = () => {
    resetForm();
    setView('create');
  };

  const openEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormName(supplier.name);
    setFormPhone(supplier.phone || '');
    setFormProductIds([...supplier.productIds]);
    setProductSearch('');
    setView('edit');
  };

  const toggleProduct = (productId: string) => {
    setFormProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSave = () => {
    if (!formName.trim()) return;

    if (view === 'create') {
      const newSupplier: Supplier = {
        id: 'sup' + Date.now(),
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        productIds: formProductIds,
      };
      setSuppliers(prev => [...prev, newSupplier]);
      addAudit({
        user: 'Admin',
        action: 'Alta Proveedor',
        element: newSupplier.name,
        newValue: `${formProductIds.length} productos asignados`,
      });
    } else if (view === 'edit' && editingId) {
      setSuppliers(prev => prev.map(s => s.id === editingId ? {
        ...s,
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        productIds: formProductIds,
      } : s));
      addAudit({
        user: 'Admin',
        action: 'Edición Proveedor',
        element: formName.trim(),
        newValue: `${formProductIds.length} productos asignados`,
      });
    }

    resetForm();
    setEditingId(null);
    setView('list');
  };

  const handleDelete = (id: string) => {
    const supplier = suppliers.find(s => s.id === id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
    if (supplier) {
      addAudit({
        user: 'Admin',
        action: 'Eliminación Proveedor',
        element: supplier.name,
      });
    }
    setDeleteConfirm(null);
  };

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

  // Form view (create / edit)
  if (view === 'create' || view === 'edit') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => { setView('list'); resetForm(); }} className="hover:text-[#3d7a3d]">Proveedores</button>
          <span className="text-foreground">›</span>
          <span className="text-foreground">{view === 'create' ? 'Nuevo Proveedor' : 'Editar Proveedor'}</span>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm max-w-2xl mx-auto">
          <h2 className="mb-6 text-foreground">{view === 'create' ? 'Nuevo Proveedor' : 'Editar Proveedor'}</h2>

          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm mb-2 text-foreground">Nombre del Proveedor *</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Ej: Distribuidora Norte"
                className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm mb-2 text-foreground">
                <Phone size={14} className="inline mr-1.5 opacity-60" />
                Teléfono
              </label>
              <input
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                placeholder="Ej: 11-2345-6789"
                className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
              />
            </div>

            {/* Product assignment */}
            <div>
              <label className="block text-sm mb-2 text-foreground">
                <Package size={14} className="inline mr-1.5 opacity-60" />
                Productos que provee ({formProductIds.length} seleccionados)
              </label>

              {/* Search products */}
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Buscar productos..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
                />
              </div>

              {/* Product checkboxes */}
              <div className="border border-border rounded-lg max-h-64 overflow-y-auto divide-y divide-border/40">
                {filteredProducts.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formProductIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="w-4 h-4 rounded accent-[#3d7a3d]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.code} · {p.category}</p>
                    </div>
                  </label>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="text-center py-4 text-sm text-muted-foreground">No se encontraron productos</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => { setView('list'); resetForm(); }} className="px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formName.trim()}
                className={`px-6 py-2.5 rounded-lg text-white text-sm flex items-center gap-2 transition-colors ${
                  formName.trim() ? 'bg-[#3d7a3d] hover:bg-[#2f5f2f]' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                <Check size={16} />
                {view === 'create' ? 'Crear Proveedor' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-1">{suppliers.length} proveedores registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={18} />
          Nuevo Proveedor
        </button>
      </div>

      {/* Search bar */}
      {suppliers.length > 0 && (
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedor..."
            className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
          />
        </div>
      )}

      {/* Mobile cards */}
      <div className="block sm:hidden space-y-3">
        {filteredSuppliers.map(supplier => (
          <div key={supplier.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ fontWeight: 600 }}>{supplier.name}</p>
                  {supplier.phone && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Phone size={12} /> {supplier.phone}
                    </p>
                  )}
                </div>
                <span className="text-xs bg-[#3d7a3d]/10 text-[#3d7a3d] px-2.5 py-1 rounded-full flex-shrink-0" style={{ fontWeight: 500 }}>
                  {supplier.productIds.length} productos
                </span>
              </div>

              {/* Expand products */}
              <button
                onClick={() => setExpandedSupplier(expandedSupplier === supplier.id ? null : supplier.id)}
                className="text-xs text-[#3d7a3d] mt-2 flex items-center gap-1 hover:underline"
              >
                {expandedSupplier === supplier.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Ver productos
              </button>

              {expandedSupplier === supplier.id && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {supplier.productIds.map(pid => (
                    <span key={pid} className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                      {getProductName(pid)}
                    </span>
                  ))}
                  {supplier.productIds.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Sin productos asignados</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/60 bg-muted/30">
              <button
                onClick={() => openEdit(supplier)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors border border-border/60"
              >
                <Pencil size={13} /> Editar
              </button>
              {deleteConfirm === supplier.id ? (
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="text-xs text-red-600">¿Eliminar?</span>
                  <button onClick={() => handleDelete(supplier.id)} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors">Sí</button>
                  <button onClick={() => setDeleteConfirm(null)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">No</button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(supplier.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors border border-red-200"
                >
                  <Trash2 size={13} /> Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
            {search ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="bg-muted">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Teléfono</th>
                <th className="text-center px-4 py-3 text-xs text-muted-foreground uppercase">Productos</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map(supplier => (
                <tr key={supplier.id} className="border-b border-border/40 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <p className="text-sm" style={{ fontWeight: 500 }}>{supplier.name}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{supplier.phone || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setExpandedSupplier(expandedSupplier === supplier.id ? null : supplier.id)}
                      className="inline-flex items-center gap-1 text-xs bg-[#3d7a3d]/10 text-[#3d7a3d] px-2.5 py-1 rounded-full hover:bg-[#3d7a3d]/20 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      {supplier.productIds.length} productos
                      {expandedSupplier === supplier.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {expandedSupplier === supplier.id && (
                      <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                        {supplier.productIds.map(pid => (
                          <span key={pid} className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                            {getProductName(pid)}
                          </span>
                        ))}
                        {supplier.productIds.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">Sin productos</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(supplier)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-[#3d7a3d] transition-colors"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      {deleteConfirm === supplier.id ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleDelete(supplier.id)} className="text-xs bg-red-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-600">Sí</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(supplier.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {search ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
          </div>
        )}
      </div>
    </div>
  );
}
