import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/app/providers/AppContext';
import { Calendar, AlertTriangle, Clock, Search, Download } from 'lucide-react';
import logoIcon from '@/assets/logo-LCH.png';
import { getUnitLabel } from '@/app/components/store';
import { useSearchParams } from 'react-router';
import { downloadBlobFile } from '@/app/components/download';
import { buildMultiSheetConsumptionReportXlsx } from '@/app/components/xlsxExport';
import { getStockAuditEntries } from '@/shared/utils/audit-log';

type ReportTab = 'consumo' | 'alertas' | 'historial';

export function ReportsPage() {
  const { products, orders, auditLog, salesAuditLog, warehouses, getTotalStock, consumptionLogs } = useAppContext();

  const stockAuditEntries = useMemo(
    () => getStockAuditEntries(auditLog, salesAuditLog),
    [auditLog, salesAuditLog],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<ReportTab>('consumo');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [showConsumption, setShowConsumption] = useState(false);

  const tabs: { id: ReportTab; label: string; icon: React.ElementType }[] = [
    { id: 'consumo', label: 'Consumo por Fecha', icon: Calendar },
    { id: 'alertas', label: 'Alertas Semanales', icon: AlertTriangle },
    { id: 'historial', label: 'Historial', icon: Clock },
  ];

  useEffect(() => {
    const qpTab = searchParams.get('tab');
    if (qpTab === 'consumo' || qpTab === 'alertas' || qpTab === 'historial') {
      setTab(qpTab);
      if (qpTab !== 'consumo') setShowConsumption(false);
    }
    // Only initialize from URL on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTabAndUrl = (next: ReportTab) => {
    setTab(next);
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const logDayKey = (log: { day?: string; date: string; createdAtISO?: string }): string | null => {
    if (log.day && /^\d{4}-\d{2}-\d{2}$/.test(log.day)) return log.day;
    if (log.createdAtISO) return log.createdAtISO.slice(0, 10);
    // Legacy: "dd/mm/yyyy hh:mm" (es-AR)
    const m = log.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  };

  const selectedLogs = useMemo(() => {
    return consumptionLogs.filter(l => logDayKey(l) === selectedDate);
  }, [consumptionLogs, selectedDate]);

  const consumptionRows = useMemo(() => {
    const map = new Map<string, {
      productId: string;
      productName: string;
      warehouseId: string;
      warehouseName: string;
      unit: 'unidades' | 'kg';
      previousStock: number;
      newStock: number;
      consumed: number;
      dateType: 'regular' | 'after';
    }>();

    for (const log of selectedLogs) {
      for (const e of log.entries) {
        const key = `${e.productId}__${e.warehouseId}__${log.dateType}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            productId: e.productId,
            productName: e.productName,
            warehouseId: e.warehouseId,
            warehouseName: e.warehouseName,
            unit: e.unit,
            previousStock: e.previousStock,
            newStock: e.newStock,
            consumed: e.consumed,
            dateType: log.dateType,
          });
        } else {
          existing.consumed += e.consumed;
          existing.newStock = e.newStock;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.warehouseName.localeCompare(b.warehouseName, 'es') || a.productName.localeCompare(b.productName, 'es')
    );
  }, [selectedLogs]);

  const downloadConsumptionCSV = () => {
    // Build one sheet per tipo (Regular / After) for the selected day.
    const regular = consumptionRows
      .filter(r => r.dateType === 'regular')
      .map(r => ({
        product: r.productName,
        previousStock: r.previousStock,
        newStock: r.newStock,
        consumed: r.consumed,
      }));

    const after = consumptionRows
      .filter(r => r.dateType === 'after')
      .map(r => ({
        product: r.productName,
        previousStock: r.previousStock,
        newStock: r.newStock,
        consumed: r.consumed,
      }));

    const sheets = [
      ...(regular.length ? [{ dateType: 'regular' as const, rows: regular }] : []),
      ...(after.length ? [{ dateType: 'after' as const, rows: after }] : []),
    ];

    const blob = buildMultiSheetConsumptionReportXlsx({
      day: selectedDate,
      sheets,
    });

    downloadBlobFile({
      filename: `reporte-consumo-${selectedDate}.xlsx`,
      blob,
    });
  };

  // Stock alerts
  const weeklyAvg = 30; // Mock weekly average
  const pendingOrdersQty = (productId: string) => {
    return orders.filter(o => o.status === 'Pendiente').reduce((sum, o) => {
      const item = o.items.find(i => i.productId === productId);
      return sum + (item?.quantityOrdered || 0);
    }, 0);
  };

  const alertProducts = products.filter(p => {
    const current = getTotalStock(p);
    const pending = pendingOrdersQty(p.id);
    return (current + pending) < weeklyAvg;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">Consultas y análisis de stock</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card rounded-xl border border-border p-1 shadow-sm overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTabAndUrl(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#3d7a3d] text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Consumo por Fecha */}
      {tab === 'consumo' && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h3 className="mb-4">Resumen de Consumo por Fecha</h3>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
            />
            <button
              onClick={() => setShowConsumption(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#3d7a3d] text-white text-sm hover:bg-[#2f5f2f]"
            >
              <Search size={16} />
              Consultar
            </button>
            <button
              onClick={downloadConsumptionCSV}
              disabled={consumptionRows.length === 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm border transition-colors ${consumptionRows.length === 0
                  ? 'bg-muted text-muted-foreground border-border/40 cursor-not-allowed'
                  : 'bg-card text-[#3d7a3d] border-border hover:bg-muted'
                }`}
              title={consumptionRows.length === 0 ? 'No hay consumo para exportar' : 'Descargar .xlsx'}
            >
              <Download size={16} />
              Descargar .xlsx
            </button>
          </div>

          {showConsumption && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Producto</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Almacén</th>
                    <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Stock Ant.</th>
                    <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Stock Actual</th>
                    <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Consumido</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {consumptionRows.map((row, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3 text-sm">{row.productName}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{row.warehouseName}</td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">{row.previousStock}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ fontWeight: 500 }}>{row.newStock}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ fontWeight: 600 }}>
                        {row.consumed} {getUnitLabel(row.unit, true)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-1 rounded-full ${row.dateType === 'after' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`} style={{ fontWeight: 600 }}>
                          {row.dateType === 'after' ? 'After' : 'Regular'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-3 border-t border-border flex justify-between text-sm">
                <span className="text-muted-foreground">Fecha consultada: {selectedDate}</span>
                <span style={{ fontWeight: 500 }}>
                  Total consumido: {consumptionRows.reduce((s, r) => s + (r.consumed > 0 ? r.consumed : 0), 0)} unidades
                </span>
              </div>
              {consumptionRows.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  No hay registros de consumo para esta fecha.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alertas Semanales */}
      {tab === 'alertas' && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={20} className="text-amber-600" />
            <h3>Alertas de Stock Faltante</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            Productos en riesgo para esta semana. Fórmula:
          </p>
          <div className="bg-muted rounded-lg px-4 py-2 text-xs text-muted-foreground mb-6 inline-block">
            (Stock Actual + Pedidos Pendientes) &lt; Promedio Semanal ({weeklyAvg} uds)
          </div>

          {alertProducts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={20} className="text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">No hay alertas de stock esta semana.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertProducts.map(p => {
                const current = getTotalStock(p);
                const pending = pendingOrdersQty(p.id);
                return (
                  <div key={p.id} className="border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm" style={{ fontWeight: 500 }}>{p.name}</span>
                      <span className="text-xs bg-amber-200 dark:bg-amber-700/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">Alerta</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                      <div>
                        <p>Stock Actual</p>
                        <p className="text-foreground" style={{ fontWeight: 600 }}>{current}</p>
                      </div>
                      <div>
                        <p>Pedidos Pendientes</p>
                        <p className="text-foreground" style={{ fontWeight: 600 }}>+{pending}</p>
                      </div>
                      <div>
                        <p>Promedio Semanal</p>
                        <p className="text-red-600" style={{ fontWeight: 600 }}>{weeklyAvg}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                      Déficit: {weeklyAvg - (current + pending)} unidades
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Historial */}
      {tab === 'historial' && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3>Historial de Modificaciones</h3>
            <p className="text-sm text-muted-foreground mt-1">Registro de cambios del módulo Stock</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Fecha y Hora</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Acción</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Elemento</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Anterior</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {stockAuditEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Sin registros de cambios en stock
                    </td>
                  </tr>
                ) : (
                  stockAuditEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-border/40 hover:bg-muted/50">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{entry.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <img src={logoIcon} alt="" className="logo-sidebar w-6 h-6 rounded-full" />
                          <span className="text-sm">{entry.user}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.action}</td>
                      <td className="px-4 py-3 text-sm" style={{ fontWeight: 500 }}>{entry.element}</td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">{entry.previousValue || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ fontWeight: 500 }}>{entry.newValue || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}