import { useMemo, useState } from 'react';
import { useAppContext } from '@/app/providers/AppContext';
import type { EmployeeConsumptionEntry, Product } from '@/app/components/store';
import { getUnitLabel } from '@/app/components/store';
import { CategoryIconBadge } from '@/features/inventory/lib/category-icon-badge';
import { Search, Package, Minus, Plus, Check, History, X } from 'lucide-react';

function warehousesWithStock(product: Product, warehouseIds: { id: string; name: string }[]) {
  return warehouseIds.filter(w => {
    const row = product.stockByWarehouse.find(s => s.warehouseId === w.id);
    return row && row.quantity > 0;
  });
}

export function RegisterConsumptionPage() {
  const {
    products,
    setProducts,
    warehouses,
    categories,
    currentUser,
    employeeConsumptionLogs,
    setEmployeeConsumptionLogs,
    getTotalStock,
    addAudit,
    addStockMovements,
    inventoryApiAvailable,
    registerEmployeeConsumption,
  } = useAppContext();

  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const availableProducts = useMemo(
    () =>
      products
        .filter(p => getTotalStock(p) > 0)
        .filter(
          p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.code.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [products, search, getTotalStock],
  );

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return employeeConsumptionLogs;
    return employeeConsumptionLogs.filter(
      e =>
        e.productName.toLowerCase().includes(q) ||
        (e.productCode ?? '').toLowerCase().includes(q) ||
        (e.warehouseName ?? '').toLowerCase().includes(q),
    );
  }, [employeeConsumptionLogs, historySearch]);

  const selectedProduct = selectedProductId
    ? products.find(p => p.id === selectedProductId) ?? null
    : null;

  const stockWarehouses = useMemo(() => {
    if (!selectedProduct) return [];
    return warehousesWithStock(selectedProduct, warehouses);
  }, [selectedProduct, warehouses]);

  const openProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const withStock = warehousesWithStock(product, warehouses);
    setSelectedProductId(productId);
    setQuantity(1);
    setError('');
    setSuccessMsg('');
    setWarehouseId(withStock[0]?.id ?? '');
  };

  const closePanel = () => {
    setSelectedProductId(null);
    setError('');
  };

  const registerConsumption = async () => {
    if (!selectedProduct) return;
    if (!warehouseId) {
      setError('Seleccioná un almacén con stock disponible.');
      return;
    }
    const qty = Math.max(1, Math.floor(quantity));
    const stockRow = selectedProduct.stockByWarehouse.find(s => s.warehouseId === warehouseId);
    if (!stockRow || stockRow.quantity < qty) {
      setError(`Stock insuficiente (disponible: ${stockRow?.quantity ?? 0} ${getUnitLabel(selectedProduct.unit, true)}).`);
      return;
    }

    const warehouse = warehouses.find(w => w.id === warehouseId);
    const previousStock = stockRow.quantity;
    const newStock = previousStock - qty;
    const now = new Date();

    if (inventoryApiAvailable) {
      try {
        await registerEmployeeConsumption({
          productId: selectedProduct.id,
          warehouseId,
          quantity: qty,
          operatorId: currentUser.id,
          operatorName: currentUser.name,
          operatorRole: currentUser.role,
        });
        addAudit({
          user: currentUser.username,
          action: 'Registro de consumo',
          element: selectedProduct.name,
          previousValue: `${previousStock} ${getUnitLabel(selectedProduct.unit, true)}`,
          newValue: `-${qty} → ${newStock} (${warehouse?.name})`,
        });
        setSuccessMsg(`Registrado: -${qty} ${getUnitLabel(selectedProduct.unit, true)} de ${selectedProduct.name}.`);
        setSelectedProductId(null);
        setQuantity(1);
        setError('');
      } catch {
        setError('No se pudo registrar el consumo en el servidor.');
      }
      return;
    }

    const entry: EmployeeConsumptionEntry = {
      id: `emp-cons-${Date.now()}`,
      date: now.toLocaleString('es-AR'),
      day: now.toISOString().slice(0, 10),
      createdAtISO: now.toISOString(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productCode: selectedProduct.code,
      warehouseId,
      warehouseName: warehouse?.name ?? warehouseId,
      quantity: qty,
      unit: selectedProduct.unit,
      previousStock,
      newStock,
    };

    setProducts(prev =>
      prev.map(p => {
        if (p.id !== selectedProduct.id) return p;
        return {
          ...p,
          stockByWarehouse: p.stockByWarehouse.map(s =>
            s.warehouseId === warehouseId ? { ...s, quantity: newStock } : s,
          ),
        };
      }),
    );

    setEmployeeConsumptionLogs(prev => [entry, ...prev]);
    addStockMovements(
      [
        {
          type: 'consumo',
          productId: selectedProduct.id,
          warehouseId,
          quantity: -qty,
          reference: entry.id,
          operatorId: currentUser.username,
          operatorName: currentUser.username,
        },
      ],
      entry.createdAtISO,
    );
    addAudit({
      user: currentUser.username,
      action: 'Registro de consumo',
      element: selectedProduct.name,
      previousValue: `${previousStock} ${getUnitLabel(selectedProduct.unit, true)}`,
      newValue: `-${qty} → ${newStock} (${warehouse?.name})`,
    });

    setSuccessMsg(`Registrado: -${qty} ${getUnitLabel(selectedProduct.unit, true)} de ${selectedProduct.name}.`);
    setSelectedProductId(null);
    setQuantity(1);
    setError('');
  };

  const getCatIconName = (categoryName: string) => {
    return categories.find(c => c.name === categoryName)?.icon ?? 'Package';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Registrar Consumo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registrá retiros de productos (no son ventas). El stock se descuenta automáticamente.
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#3d7a3d]/10 border border-[#3d7a3d]/30 text-sm text-[#2f5f2f] dark:text-[#8bc48b]">
          <Check size={18} className="flex-shrink-0" />
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="ml-auto p-1 hover:bg-[#3d7a3d]/10 rounded">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto por nombre o código..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 outline-none"
        />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <p className="text-sm" style={{ fontWeight: 600 }}>
            Productos con stock ({availableProducts.length})
          </p>
        </div>
        {availableProducts.length === 0 ? (
          <p className="text-center py-12 text-sm text-muted-foreground">No hay productos con stock disponible</p>
        ) : (
          <ul className="divide-y divide-border/60 max-h-[min(420px,50vh)] overflow-y-auto">
            {availableProducts.map(product => {
              const total = getTotalStock(product);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => openProduct(product.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <CategoryIconBadge iconName={getCatIconName(product.category)} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ fontWeight: 500 }}>{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.code} · {product.category}</p>
                    </div>
                    <span className="text-sm flex-shrink-0" style={{ fontWeight: 600 }}>
                      {total} {getUnitLabel(product.unit, true)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={closePanel}>
          <div
            className="bg-card rounded-xl shadow-2xl w-full max-w-md border border-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <Package size={18} className="text-[#3d7a3d] flex-shrink-0" />
                <h3 className="text-foreground truncate">{selectedProduct.name}</h3>
              </div>
              <button type="button" onClick={closePanel} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Código {selectedProduct.code} · Stock total: {getTotalStock(selectedProduct)}{' '}
                {getUnitLabel(selectedProduct.unit, true)}
              </p>

              {stockWarehouses.length === 0 ? (
                <p className="text-sm text-red-600">Sin stock en ningún almacén.</p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm mb-1">Almacén</label>
                    <select
                      value={warehouseId}
                      onChange={e => setWarehouseId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-input-background border border-border outline-none text-sm"
                    >
                      {stockWarehouses.map(w => {
                        const qty =
                          selectedProduct.stockByWarehouse.find(s => s.warehouseId === w.id)?.quantity ?? 0;
                        return (
                          <option key={w.id} value={w.id}>
                            {w.name} ({qty} {getUnitLabel(selectedProduct.unit, true)})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Cantidad</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="flex-1 px-3 py-2 rounded-lg bg-input-background border border-border text-center text-sm outline-none focus:border-[#3d7a3d]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const max =
                            selectedProduct.stockByWarehouse.find(s => s.warehouseId === warehouseId)
                              ?.quantity ?? 1;
                          setQuantity(q => Math.min(max, q + 1));
                        }}
                        className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80"
                      >
                        <Plus size={16} />
                      </button>
                      <span className="text-xs text-muted-foreground w-8">
                        {getUnitLabel(selectedProduct.unit, true)}
                      </span>
                    </div>
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <button
                    type="button"
                    onClick={registerConsumption}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#3d7a3d] text-white text-sm hover:bg-[#2f5f2f] transition-colors"
                  >
                    <Check size={18} />
                    Registrar consumo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <History size={18} className="text-[#3d7a3d]" />
            <p className="text-sm" style={{ fontWeight: 600 }}>
              Historial de consumos ({filteredHistory.length})
            </p>
          </div>
          <div className="relative sm:ml-auto w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Buscar en historial..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
            />
          </div>
        </div>
        {employeeConsumptionLogs.length === 0 ? (
          <p className="text-center py-10 text-sm text-muted-foreground">Aún no hay consumos registrados</p>
        ) : filteredHistory.length === 0 ? (
          <p className="text-center py-10 text-sm text-muted-foreground">No se encontraron consumos para "{historySearch}"</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-muted text-xs text-muted-foreground uppercase">
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-left px-4 py-2.5">Producto</th>
                  <th className="text-left px-4 py-2.5">Almacén</th>
                  <th className="text-right px-4 py-2.5">Cantidad</th>
                  <th className="text-right px-4 py-2.5">Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.slice(0, 50).map(entry => (
                  <tr key={entry.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{entry.date}</td>
                    <td className="px-4 py-2.5 text-sm">
                      {entry.productName}
                      <span className="block text-xs text-muted-foreground">{entry.productCode}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{entry.warehouseName}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-orange-600" style={{ fontWeight: 600 }}>
                      -{entry.quantity} {getUnitLabel(entry.unit, true)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-muted-foreground">
                      {entry.previousStock} → {entry.newStock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
