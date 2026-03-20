import { useState } from 'react';
import { useAppContext } from './AppContext';
import { getUnitLabel } from './store';
import { Plus, Edit, Trash2, X, Warehouse, Package, ChevronDown, ChevronUp, Beer, Coffee, UtensilsCrossed, Refrigerator, Archive, ShoppingCart, Flame, Sandwich, Box, Star, Zap, Droplets } from 'lucide-react';
import type { Warehouse as WarehouseType } from './store';

const WAREHOUSE_ICONS: Record<string, React.ComponentType<any>> = {
  Warehouse, Package, Beer, Coffee, UtensilsCrossed, Refrigerator,
  Archive, ShoppingCart, Flame, Sandwich, Box, Star, Zap, Droplets,
};

function getWarehouseIcon(iconName?: string): React.ComponentType<any> {
  return (iconName && WAREHOUSE_ICONS[iconName]) ? WAREHOUSE_ICONS[iconName] : Warehouse;
}

export function WarehousesPage() {
  const { warehouses, setWarehouses, products, getWarehouseTotalProducts, addAudit } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WarehouseType | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {warehouses.map(wh => {
          const totalUnits = getWarehouseTotalProducts(wh.id);
          const isExpanded = expandedId === wh.id;
          const warehouseProducts = products.filter(p => p.stockByWarehouse.some(s => s.warehouseId === wh.id));

          return (
            <div key={wh.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div
                className="p-5 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpand(wh.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#3d7a3d]/10 p-2.5 rounded-lg">
                      {(() => { const Icon = getWarehouseIcon(wh.icon); return <Icon size={22} className="text-[#3d7a3d]" />; })()}
                    </div>
                    <div>
                      <h3>{wh.name}</h3>
                      <p className="text-sm text-muted-foreground">{wh.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(wh); setShowModal(true); }}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(wh.id); }}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="p-2 text-muted-foreground">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm mt-1">
                  <span className="text-muted-foreground"><span style={{ fontWeight: 600 }} className="text-foreground">{warehouseProducts.length}</span> producto(s)</span>
                  <span className="text-muted-foreground"><span style={{ fontWeight: 600 }} className="text-foreground">{totalUnits}</span> unidades</span>
                </div>
              </div>

              {/* Expanded products list */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/40">
                  <div className="px-5 py-3">
                    <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 500 }}>Productos en este almacén</p>
                    <div className="space-y-1.5">
                      {warehouseProducts.map(p => {
                        const stock = p.stockByWarehouse.find(s => s.warehouseId === wh.id);
                        return (
                          <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-card rounded-lg">
                            <div className="flex items-center gap-2">
                              <Package size={14} className="text-[#3d7a3d]" />
                              <span className="text-sm">{p.name}</span>
                            </div>
                            <span className="text-sm" style={{ fontWeight: 500 }}>{stock?.quantity || 0} {getUnitLabel(p.unit, true)}</span>
                          </div>
                        );
                      })}
                      {warehouseProducts.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Sin productos en este almacén</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

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