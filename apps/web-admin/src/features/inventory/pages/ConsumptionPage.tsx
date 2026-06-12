import { useEffect, useState } from 'react';
import { useAppContext } from '@/app/providers/AppContext';
import { CategoryIconBadge } from '@/features/inventory/lib/category-icon-badge';
import { getWarehouseIcon } from '@/features/inventory/lib/warehouse-icons';
import { ChevronDown, ChevronUp, Check, Download, Calendar, ClipboardList, Search } from 'lucide-react';
import type { ConsumptionLog, StockCountSession } from '@/app/components/store';
import { getUnitLabel } from '@/app/components/store';
import { downloadBlobFile } from '@/app/components/download';
import { buildConsumptionReportXlsx } from '@/app/components/xlsxExport';

type DateType = 'regular' | 'after';

interface StockEdit {
  warehouseId: string;
  productId: string;
  previousStock: number;
  newStock: number;
}

export function ConsumptionPage() {
  const { products, warehouses, categories, setProducts, consumptionLogs, setConsumptionLogs, setStockCountSessions, currentUser, addAudit } = useAppContext();
  const [dateType, setDateType] = useState<DateType>('regular');
  const [expandedWarehouse, setExpandedWarehouse] = useState<string | null>(null);
  const [warehouseSearch, setWarehouseSearch] = useState('');

  useEffect(() => {
    setWarehouseSearch('');
  }, [expandedWarehouse]);

  const getCatIconName = (categoryName: string) =>
    categories.find(c => c.name === categoryName)?.icon ?? 'Package';
  const [edits, setEdits] = useState<StockEdit[]>(() => {
    // Pre-populate with current stock values
    const all: StockEdit[] = [];
    for (const product of products) {
      for (const s of product.stockByWarehouse) {
        all.push({
          warehouseId: s.warehouseId,
          productId: product.id,
          previousStock: s.quantity,
          newStock: s.quantity,
        });
      }
    }
    return all;
  });
  const [saved, setSaved] = useState(false);
  const [lastLog, setLastLog] = useState<ConsumptionLog | null>(null);

  const getEdit = (warehouseId: string, productId: string) =>
    edits.find(e => e.warehouseId === warehouseId && e.productId === productId);

  const updateEdit = (warehouseId: string, productId: string, newStock: number) => {
    setEdits(prev => prev.map(e =>
      e.warehouseId === warehouseId && e.productId === productId
        ? { ...e, newStock: Math.max(0, newStock) }
        : e
    ));
  };

  const hasChanges = edits.some(e => e.newStock !== e.previousStock);

  const handleSave = () => {
    const now = new Date();
    const today = now.toLocaleDateString('es-AR');
    const day = now.toISOString().slice(0, 10);
    const changedEdits = edits.filter(e => e.newStock !== e.previousStock);

    // Build consumption log entries
    const entries: ConsumptionLog['entries'] = changedEdits.map(e => {
      const product = products.find(p => p.id === e.productId)!;
      const warehouse = warehouses.find(w => w.id === e.warehouseId)!;
      return {
        productId: e.productId,
        productName: product?.name || e.productId,
        warehouseId: e.warehouseId,
        warehouseName: warehouse?.name || e.warehouseId,
        previousStock: e.previousStock,
        newStock: e.newStock,
        consumed: e.previousStock - e.newStock,
        unit: product?.unit || 'unidades',
      };
    });

    const newLog: ConsumptionLog = {
      id: `cons-${Date.now()}`,
      date: today + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      day,
      createdAtISO: now.toISOString(),
      dateType,
      entries,
    };

    // Update products with new stock values
    setProducts(prev => prev.map(p => {
      const changed = changedEdits.filter(e => e.productId === p.id);
      if (changed.length === 0) return p;
      return {
        ...p,
        stockByWarehouse: p.stockByWarehouse.map(s => {
          const edit = changed.find(e => e.warehouseId === s.warehouseId);
          return edit ? { ...s, quantity: edit.newStock } : s;
        }),
      };
    }));

    // Save consumption log
    setConsumptionLogs(prev => [newLog, ...prev]);

    // Save full stock-count session (esperado vs contado, todos los productos).
    const productAgg = new Map<string, { expected: number; counted: number }>();
    for (const e of edits) {
      const agg = productAgg.get(e.productId) ?? { expected: 0, counted: 0 };
      agg.expected += e.previousStock;
      agg.counted += e.newStock;
      productAgg.set(e.productId, agg);
    }
    const countSession: StockCountSession = {
      id: `count-${Date.now()}`,
      createdAtISO: now.toISOString(),
      date: newLog.date,
      dateType,
      operatorId: currentUser?.username,
      operatorName: currentUser?.username,
      entries: Array.from(productAgg.entries()).map(([productId, agg]) => {
        const product = products.find(p => p.id === productId);
        return {
          productId,
          productName: product?.name ?? productId,
          unit: product?.unit ?? 'unidades',
          expected: agg.expected,
          counted: agg.counted,
        };
      }),
    };
    setStockCountSessions(prev => [countSession, ...prev]);

    // Audit
    addAudit({
      user: 'Admin',
      action: `Registro de Consumo (${dateType === 'after' ? 'After' : 'Regular'})`,
      element: `${entries.length} productos actualizados`,
      previousValue: '-',
      newValue: today,
    });

    // Update previous stocks for next session
    setEdits(prev => prev.map(e => ({ ...e, previousStock: e.newStock })));
    setSaved(true);
    setLastLog(newLog);
  };

  const downloadXlsx = (log: ConsumptionLog) => {
    const day = log.day || (log.createdAtISO ? log.createdAtISO.slice(0, 10) : '');
    if (!day) return;

    const blob = buildConsumptionReportXlsx({
      day,
      dateType: log.dateType,
      rows: log.entries.map(e => ({
        product: e.productName,
        previousStock: e.previousStock,
        newStock: e.newStock,
        consumed: e.consumed,
      })),
    });

    downloadBlobFile({
      filename: `reporte-consumo-${day}-${log.dateType}.xlsx`,
      blob,
    });
  };

  if (saved && lastLog) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground">Controlar Stock</h1>
          <p className="text-sm text-muted-foreground mt-1">Consumo registrado correctamente</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#3d7a3d]/10 rounded-full flex items-center justify-center">
              <Check size={24} className="text-[#3d7a3d]" />
            </div>
            <div>
              <p className="text-sm" style={{ fontWeight: 600 }}>Consumo guardado</p>
              <p className="text-xs text-muted-foreground">{lastLog.date} · {lastLog.dateType === 'after' ? 'After / Especial' : 'Regular'} · {lastLog.entries.length} productos</p>
            </div>
          </div>

          {/* Report table */}
          <div className="rounded-lg border border-border overflow-hidden mb-4">
            <div className="bg-[#3d7a3d] px-4 py-2.5 flex items-center gap-2">
              <ClipboardList size={16} className="text-white" />
              <span className="text-sm text-white" style={{ fontWeight: 600 }}>Reporte de Consumo</span>
            </div>
            {/* Mobile view */}
            <div className="block sm:hidden divide-y divide-border">
              {lastLog.entries.map((e, i) => (
                <div key={i} className="px-4 py-3 bg-card">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm" style={{ fontWeight: 500 }}>{e.productName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.consumed > 0 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' : e.consumed < 0 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`} style={{ fontWeight: 600 }}>
                      {e.consumed > 0 ? '-' : e.consumed < 0 ? '+' : ''}{Math.abs(e.consumed)} {getUnitLabel(e.unit, true)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.warehouseName}</p>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Anterior: <strong>{e.previousStock}</strong></span>
                    <span>Actual: <strong>{e.newStock}</strong></span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground uppercase">Producto</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground uppercase">Almacén</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground uppercase">Ant.</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground uppercase">Actual</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground uppercase">Consumido</th>
                  </tr>
                </thead>
                <tbody>
                  {lastLog.entries.map((e, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2.5 text-sm" style={{ fontWeight: 500 }}>{e.productName}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{e.warehouseName}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">{e.previousStock}</td>
                      <td className="px-4 py-2.5 text-sm text-right" style={{ fontWeight: 500 }}>{e.newStock}</td>
                      <td className={`px-4 py-2.5 text-sm text-right ${e.consumed > 0 ? 'text-orange-600 dark:text-orange-400' : e.consumed < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} style={{ fontWeight: 600 }}>
                        {e.consumed > 0 ? '-' : e.consumed < 0 ? '+' : ''}{Math.abs(e.consumed)} {getUnitLabel(e.unit, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted border-t border-border">
                    <td colSpan={4} className="px-4 py-2.5 text-sm text-right text-muted-foreground">Total consumido:</td>
                    <td className="px-4 py-2.5 text-sm text-right text-orange-700 dark:text-orange-300" style={{ fontWeight: 700 }}>
                      {lastLog.entries.filter(e => e.consumed > 0).reduce((s, e) => s + e.consumed, 0)} uds
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => downloadXlsx(lastLog)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3d7a3d] text-white text-sm hover:bg-[#2f5f2f] transition-colors"
            >
              <Download size={16} />
              Descargar .xlsx
            </button>
            <button
              onClick={() => setSaved(false)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm hover:bg-muted text-foreground transition-colors"
            >
              Nuevo registro
            </button>
          </div>
        </div>

        {/* Previous logs */}
        {consumptionLogs.length > 1 && (
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="text-foreground mb-4">Registros Anteriores</h3>
            <div className="space-y-2">
              {consumptionLogs.slice(1, 5).map(log => (
                <div key={log.id} className="flex items-center justify-between py-2.5 px-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm" style={{ fontWeight: 500 }}>{log.date}</p>
                    <p className="text-xs text-muted-foreground">{log.dateType === 'after' ? 'After' : 'Regular'} · {log.entries.length} productos</p>
                  </div>
                  <button onClick={() => downloadXlsx(log)} className="p-2 rounded-lg text-[#3d7a3d] hover:bg-[#3d7a3d]/10">
                    <Download size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Controlar Stock</h1>
        <p className="text-sm text-muted-foreground mt-1">Actualizá el stock actual por almacén</p>
      </div>

      {/* Date type selector */}
      <div className="bg-card/60 rounded-xl border border-border/60 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={18} className="text-[#3d7a3d]" />
          <p className="text-sm" style={{ fontWeight: 600 }}>Tipo de Fecha</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDateType('regular')}
            className={`p-3 rounded-lg border text-left transition-all ${
              dateType === 'regular' ? 'border-[#3d7a3d] bg-[#3d7a3d]/5' : 'border-border/60 hover:bg-muted/40'
            }`}
          >
            <p className="text-sm" style={{ fontWeight: 600 }}>Regular</p>
            <p className="text-xs text-muted-foreground mt-0.5">Semana normal de operación</p>
          </button>
          <button
            onClick={() => setDateType('after')}
            className={`p-3 rounded-lg border text-left transition-all ${
              dateType === 'after' ? 'border-[#3d7a3d] bg-[#3d7a3d]/5' : 'border-border/60 hover:bg-muted/40'
            }`}
          >
            <p className="text-sm" style={{ fontWeight: 600 }}>After / Especial</p>
            <p className="text-xs text-muted-foreground mt-0.5">Evento especial (mayor demanda)</p>
          </button>
        </div>
      </div>

      {/* Warehouses accordion */}
      <div className="space-y-3">
        {warehouses.map(warehouse => {
          const warehouseProducts = products.filter(p =>
            p.stockByWarehouse.some(s => s.warehouseId === warehouse.id)
          );
          const isExpanded = expandedWarehouse === warehouse.id;
          const warehouseEdits = edits.filter(e => e.warehouseId === warehouse.id);
          const hasWarehouseChanges = warehouseEdits.some(e => e.newStock !== e.previousStock);
          const searchQuery = warehouseSearch.trim().toLowerCase();
          const filteredWarehouseProducts = warehouseProducts
            .filter(
              p =>
                !searchQuery ||
                p.name.toLowerCase().includes(searchQuery) ||
                p.code.toLowerCase().includes(searchQuery),
            )
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));

          return (
            <div
              key={warehouse.id}
              className={`bg-card rounded-xl border shadow-sm overflow-hidden transition-all ${
                isExpanded ? 'border-[#3d7a3d]/50 shadow-md' : 'border-border hover:border-border/80'
              }`}
            >
              <button
                onClick={() => setExpandedWarehouse(isExpanded ? null : warehouse.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      hasWarehouseChanges ? 'bg-amber-100 dark:bg-amber-900/40' : isExpanded ? 'bg-[#3d7a3d]/10' : 'bg-muted'
                    }`}
                  >
                    {(() => {
                      const Icon = getWarehouseIcon(warehouse.icon);
                      return <Icon size={20} className={hasWarehouseChanges ? 'text-amber-700 dark:text-amber-300' : 'text-[#3d7a3d]'} />;
                    })()}
                  </div>
                  <div>
                    <p className="text-sm" style={{ fontWeight: 600 }}>{warehouse.name}</p>
                    <p className="text-xs text-muted-foreground">{warehouse.location} · {warehouseProducts.length} productos</p>
                  </div>
                  {hasWarehouseChanges && (
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full" style={{ fontWeight: 500 }}>Modificado</span>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={18} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={18} className="text-muted-foreground flex-shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border bg-muted/30">
                  {warehouseProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sin productos en este almacén</p>
                  ) : (
                    <>
                      <div className="px-5 pt-4 pb-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>
                            Productos en este depósito
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {filteredWarehouseProducts.length} de {warehouseProducts.length}
                          </span>
                        </div>
                        <div className="relative">
                          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={warehouseSearch}
                            onChange={e => setWarehouseSearch(e.target.value)}
                            placeholder="Buscar por nombre o código..."
                            className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 text-foreground"
                          />
                        </div>
                      </div>
                      <div className="divide-y divide-border max-h-[min(480px,55vh)] overflow-y-auto">
                        {filteredWarehouseProducts.map(product => {
                            const edit = getEdit(warehouse.id, product.id);
                            if (!edit) return null;
                            const consumed = edit.previousStock - edit.newStock;
                            return (
                              <div key={product.id} className="px-5 py-3 flex items-center gap-3 bg-card/80">
                                <CategoryIconBadge iconName={getCatIconName(product.category)} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate" style={{ fontWeight: 500 }}>{product.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {product.code} · Stock previo: {edit.previousStock} {getUnitLabel(product.unit, true)}
                                    {consumed !== 0 && (
                                      <span className={`ml-2 ${consumed > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`} style={{ fontWeight: 600 }}>
                                        {consumed > 0 ? `–${consumed}` : `+${Math.abs(consumed)}`} {getUnitLabel(product.unit, true)}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => updateEdit(warehouse.id, product.id, edit.newStock - 1)}
                                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-foreground hover:bg-muted/70 transition-colors"
                                  >
                                    –
                                  </button>
                                  <input
                                    type="number"
                                    value={edit.newStock}
                                    onChange={e => updateEdit(warehouse.id, product.id, parseInt(e.target.value) || 0)}
                                    className="w-16 px-2 py-1.5 rounded-lg bg-input-background border border-border outline-none text-sm text-center focus:border-[#3d7a3d] text-foreground"
                                    min={0}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateEdit(warehouse.id, product.id, edit.newStock + 1)}
                                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-foreground hover:bg-muted/70 transition-colors"
                                  >
                                    +
                                  </button>
                                  <span className="text-xs text-muted-foreground w-6">{getUnitLabel(product.unit, true)}</span>
                                </div>
                              </div>
                            );
                          })}
                        {filteredWarehouseProducts.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-6">No hay productos con esa búsqueda</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm shadow-lg transition-all ${hasChanges ? 'bg-[#3d7a3d] hover:bg-[#2f5f2f] active:scale-95' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
        >
          <Check size={18} />
          Guardar y Ver Reporte
        </button>
      </div>
    </div>
  );
}
