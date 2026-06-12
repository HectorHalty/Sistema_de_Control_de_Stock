import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/app/providers/AppContext';
import { ClipboardCheck, AlertTriangle, Clock, Download, TrendingDown, TrendingUp, ArrowLeftRight, Search } from 'lucide-react';
import { getUnitLabel } from '@/app/components/store';
import type { StockMovementType, StockCountSession } from '@/app/components/store';
import { useSearchParams } from 'react-router';
import { downloadBlobFile } from '@/app/components/download';
import { buildReconciliationXlsx } from '@/app/components/xlsxExport';
import { calculateAvgDailyDemandFromMovements } from '@/features/kitchen/domain';
import { getStockAuditEntries } from '@/shared/utils/audit-log';
import { AuditHistoryTable } from '@/shared/components/AuditHistoryTable';
import { buildReconciliation, findPreviousSession, sortCountSessionsDesc } from '@/features/inventory/reconciliation';

type ReportTab = 'control' | 'movimientos' | 'alertas' | 'historial';

const LIVE_SESSION_ID = 'current';

function formatSessionLabel(dateStr: string, dateType: 'regular' | 'after'): string {
  return `${dateStr} · ${dateType === 'after' ? 'After' : 'Regular'}`;
}

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  venta: 'Venta',
  venta_anulada: 'Anulación',
  devolucion: 'Devolución',
  consumo: 'Consumo',
  entrada: 'Entrada (pedido)',
  ajuste_manual: 'Ajuste manual',
};

function movementBadgeClass(type: StockMovementType): string {
  switch (type) {
    case 'venta':
      return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300';
    case 'consumo':
      return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300';
    case 'entrada':
      return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
    case 'venta_anulada':
    case 'devolucion':
      return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function ReportsPage() {
  const {
    products,
    orders,
    auditLog,
    salesAuditLog,
    getTotalStock,
    stockMovements,
    stockCountSessions,
  } = useAppContext();

  const stockAuditEntries = useMemo(
    () => getStockAuditEntries(auditLog, salesAuditLog),
    [auditLog, salesAuditLog],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<ReportTab>('control');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<StockMovementType | 'all'>('all');
  const [movementSearch, setMovementSearch] = useState('');

  const tabs: { id: ReportTab; label: string; icon: React.ElementType }[] = [
    { id: 'control', label: 'Control de Stock', icon: ClipboardCheck },
    { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
    { id: 'alertas', label: 'Alertas Semanales', icon: AlertTriangle },
    { id: 'historial', label: 'Historial', icon: Clock },
  ];

  useEffect(() => {
    const qpTab = searchParams.get('tab');
    if (qpTab === 'alertas' || qpTab === 'historial' || qpTab === 'movimientos') setTab(qpTab);
    else if (qpTab === 'control' || qpTab === 'consumo') setTab('control');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTabAndUrl = (next: ReportTab) => {
    setTab(next);
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const sortedSessions = useMemo(() => sortCountSessionsDesc(stockCountSessions), [stockCountSessions]);

  // Sesión virtual "En curso": stock actual del sistema como esperado y contado,
  // para ver ventas/consumos/entradas acumulados desde el último control sin contar.
  const liveSession = useMemo<StockCountSession>(
    () => ({
      id: LIVE_SESSION_ID,
      createdAtISO: new Date().toISOString(),
      date: 'En curso',
      dateType: 'regular',
      entries: products.map(p => {
        const total = getTotalStock(p);
        return { productId: p.id, productName: p.name, unit: p.unit, expected: total, counted: total };
      }),
    }),
    [products, getTotalStock],
  );

  const sessionChoices = useMemo(() => [liveSession, ...sortedSessions], [liveSession, sortedSessions]);

  const selectedSession = useMemo(
    () => (selectedSessionId ? sessionChoices.find(s => s.id === selectedSessionId) ?? liveSession : liveSession),
    [sessionChoices, selectedSessionId, liveSession],
  );

  const isLive = selectedSession.id === LIVE_SESSION_ID;

  const reconciliation = useMemo(() => {
    const prev = isLive ? sortedSessions[0] : findPreviousSession(stockCountSessions, selectedSession);
    return buildReconciliation(selectedSession, prev, stockMovements, products);
  }, [selectedSession, isLive, sortedSessions, stockCountSessions, stockMovements, products]);

  const visibleRows = useMemo(() => {
    if (!reconciliation) return [];
    if (isLive) {
      // En curso no hay diferencia (no se contó); ocultamos productos sin movimiento.
      return onlyDifferences
        ? reconciliation.rows.filter(r => r.entradas !== 0 || r.ventas !== 0 || r.consumos !== 0)
        : reconciliation.rows;
    }
    return onlyDifferences ? reconciliation.rows.filter(r => r.difference !== 0) : reconciliation.rows;
  }, [reconciliation, onlyDifferences, isLive]);

  const periodLabel = useMemo(() => {
    if (isLive) {
      const last = sortedSessions[0];
      return last ? `Desde ${last.date} hasta ahora · sin conteo` : 'Desde el inicio hasta ahora · sin conteo';
    }
    const prev = findPreviousSession(stockCountSessions, selectedSession);
    if (!prev) return `Primer control · hasta ${selectedSession.date}`;
    return `Desde ${prev.date} hasta ${selectedSession.date}`;
  }, [selectedSession, isLive, sortedSessions, stockCountSessions]);

  const downloadReconciliationXlsx = () => {
    if (!reconciliation || !selectedSession) return;
    const blob = buildReconciliationXlsx({
      title: `Control de Stock · ${formatSessionLabel(selectedSession.date, selectedSession.dateType)}`,
      rows: visibleRows.map(r => ({
        product: r.productName,
        initial: r.initial,
        entradas: r.entradas,
        ventas: r.ventas,
        consumos: r.consumos,
        expected: r.expected,
        counted: r.counted,
        difference: r.difference,
      })),
    });
    downloadBlobFile({
      filename: `control-stock-${selectedSession.createdAtISO.slice(0, 10)}.xlsx`,
      blob,
    });
  };

  const pendingOrdersQty = (productId: string) => {
    return orders.filter(o => o.status === 'Pendiente').reduce((sum, o) => {
      const item = o.items.find(i => i.productId === productId);
      return sum + (item?.quantityOrdered || 0);
    }, 0);
  };

  const getWeeklyAvg = (productId: string) => {
    const { avgDaily } = calculateAvgDailyDemandFromMovements(stockMovements, productId, 1);
    return Math.ceil(avgDaily * 7);
  };

  const alertProducts = useMemo(
    () =>
      products
        .map(p => {
          const weeklyAvg = getWeeklyAvg(p.id);
          const current = getTotalStock(p);
          const pending = pendingOrdersQty(p.id);
          return { product: p, weeklyAvg, current, pending };
        })
        .filter(
          ({ weeklyAvg, current, pending }) =>
            weeklyAvg > 0 && current + pending < weeklyAvg,
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, orders, stockMovements, getTotalStock],
  );

  const productNameMap = useMemo(() => new Map(products.map(p => [p.id, p.name])), [products]);

  const filteredMovements = useMemo(() => {
    const q = movementSearch.trim().toLowerCase();
    return stockMovements
      .filter(m => movementTypeFilter === 'all' || m.type === movementTypeFilter)
      .filter(m => {
        if (!q) return true;
        const name = (productNameMap.get(m.productId) ?? m.productId).toLowerCase();
        return name.includes(q) || (m.reference ?? '').toLowerCase().includes(q);
      })
      .slice(0, 300);
  }, [stockMovements, movementTypeFilter, movementSearch, productNameMap]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">Control de stock real y análisis</p>
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

      {/* Control de Stock (conciliación) */}
      {tab === 'control' && (
        <div className="space-y-4">
          {products.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-10 shadow-sm text-center">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <ClipboardCheck size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm" style={{ fontWeight: 600 }}>No hay productos cargados</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cargá productos y registrá ventas, consumos o pedidos para ver el control de stock.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <select
                    value={selectedSession.id}
                    onChange={e => setSelectedSessionId(e.target.value)}
                    className="px-4 py-2.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
                  >
                    {sessionChoices.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.id === LIVE_SESSION_ID ? 'En curso (sin conteo)' : formatSessionLabel(s.date, s.dateType)}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">{periodLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyDifferences}
                      onChange={e => setOnlyDifferences(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#3d7a3d]"
                    />
                    {isLive ? 'Solo con movimiento' : 'Solo diferencias'}
                  </label>
                  <button
                    onClick={downloadReconciliationXlsx}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border border-border bg-card text-[#3d7a3d] hover:bg-muted transition-colors"
                  >
                    <Download size={16} />
                    .xlsx
                  </button>
                </div>
              </div>

              {isLive && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  Mostrando ventas, consumos y entradas acumulados desde el último control.
                  Hacé un <span style={{ fontWeight: 600 }}>Controlar Stock</span> para comparar con el conteo físico y ver diferencias.
                </div>
              )}

              {/* Summary cards */}
              {reconciliation && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground">Stock esperado</p>
                    <p className="text-xl mt-1" style={{ fontWeight: 700 }}>{reconciliation.totals.expected}</p>
                  </div>
                  {isLive ? (
                    <>
                      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                        <p className="text-xs text-orange-600 dark:text-orange-400">Vendido (período)</p>
                        <p className="text-xl mt-1 text-orange-600 dark:text-orange-400" style={{ fontWeight: 700 }}>
                          -{reconciliation.rows.reduce((s, r) => s + r.ventas, 0)}
                        </p>
                      </div>
                      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                        <p className="text-xs text-purple-600 dark:text-purple-400">Consumido (período)</p>
                        <p className="text-xl mt-1 text-purple-600 dark:text-purple-400" style={{ fontWeight: 700 }}>
                          -{reconciliation.rows.reduce((s, r) => s + r.consumos, 0)}
                        </p>
                      </div>
                      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                        <p className="text-xs text-[#3d7a3d]">Ingresado (período)</p>
                        <p className="text-xl mt-1 text-[#3d7a3d]" style={{ fontWeight: 700 }}>
                          +{reconciliation.rows.reduce((s, r) => s + r.entradas, 0)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                        <p className="text-xs text-muted-foreground">Stock contado</p>
                        <p className="text-xl mt-1" style={{ fontWeight: 700 }}>{reconciliation.totals.counted}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/40 p-4 shadow-sm">
                        <div className="flex items-center gap-1.5">
                          <TrendingDown size={14} className="text-red-600 dark:text-red-400" />
                          <p className="text-xs text-red-700 dark:text-red-300">Faltante</p>
                        </div>
                        <p className="text-xl mt-1 text-red-700 dark:text-red-300" style={{ fontWeight: 700 }}>
                          {reconciliation.totals.faltante}
                        </p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/40 p-4 shadow-sm">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp size={14} className="text-blue-600 dark:text-blue-400" />
                          <p className="text-xs text-blue-700 dark:text-blue-300">Sobrante</p>
                        </div>
                        <p className="text-xl mt-1 text-blue-700 dark:text-blue-300" style={{ fontWeight: 700 }}>
                          +{reconciliation.totals.sobrante}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Reconciliation table */}
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h3>{isLive ? 'Movimientos desde el último control' : 'Esperado vs. Contado'}</h3>
                  {reconciliation && !isLive && (
                    <span className="text-xs text-muted-foreground">
                      {reconciliation.totals.conDiferencia} con diferencia
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="bg-muted text-xs text-muted-foreground uppercase">
                        <th className="text-left px-4 py-3">Producto</th>
                        <th className="text-right px-4 py-3">Inicial</th>
                        <th className="text-right px-4 py-3">Entradas</th>
                        <th className="text-right px-4 py-3">Ventas</th>
                        <th className="text-right px-4 py-3">Consumos</th>
                        <th className="text-right px-4 py-3">Esperado</th>
                        <th className="text-right px-4 py-3">Contado</th>
                        <th className="text-right px-4 py-3">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(row => {
                        const u = getUnitLabel(row.unit, true);
                        return (
                          <tr key={row.productId} className="border-b border-border/50">
                            <td className="px-4 py-3 text-sm" style={{ fontWeight: 500 }}>{row.productName}</td>
                            <td className="px-4 py-3 text-sm text-right text-muted-foreground">{row.initial}</td>
                            <td className="px-4 py-3 text-sm text-right text-[#3d7a3d]">{row.entradas > 0 ? `+${row.entradas}` : 0}</td>
                            <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">{row.ventas > 0 ? `-${row.ventas}` : 0}</td>
                            <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{row.consumos > 0 ? `-${row.consumos}` : 0}</td>
                            <td className="px-4 py-3 text-sm text-right text-muted-foreground">{row.expected}</td>
                            {isLive ? (
                              <>
                                <td className="px-4 py-3 text-sm text-right text-muted-foreground">—</td>
                                <td className="px-4 py-3 text-right text-sm text-muted-foreground">pendiente</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3 text-sm text-right" style={{ fontWeight: 600 }}>{row.counted}</td>
                                <td className="px-4 py-3 text-right">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-xs ${row.difference < 0
                                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                        : row.difference > 0
                                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                          : 'bg-muted text-muted-foreground'
                                      }`}
                                    style={{ fontWeight: 600 }}
                                  >
                                    {row.difference > 0 ? '+' : ''}{row.difference} {u}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {visibleRows.length === 0 && (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      {isLive
                        ? 'Sin ventas, consumos ni entradas desde el último control.'
                        : onlyDifferences
                          ? 'No hay diferencias en este control. Todo cuadra.'
                          : 'Este control no tiene productos.'}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Movimientos detallados */}
      {tab === 'movimientos' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={movementSearch}
                onChange={e => setMovementSearch(e.target.value)}
                placeholder="Buscar por producto o referencia..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-input-background border border-border outline-none text-sm focus:border-[#3d7a3d]"
              />
            </div>
            <select
              value={movementTypeFilter}
              onChange={e => setMovementTypeFilter(e.target.value as StockMovementType | 'all')}
              className="px-4 py-2.5 rounded-lg bg-input-background border border-border outline-none text-sm focus:border-[#3d7a3d]"
            >
              <option value="all">Todos los tipos</option>
              <option value="venta">Ventas</option>
              <option value="consumo">Consumos</option>
              <option value="entrada">Entradas (pedidos)</option>
              <option value="venta_anulada">Anulaciones</option>
              <option value="devolucion">Devoluciones</option>
              <option value="ajuste_manual">Ajustes manuales</option>
            </select>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3>Movimientos de Stock</h3>
              <span className="text-xs text-muted-foreground">
                {filteredMovements.length} {filteredMovements.length === 1 ? 'movimiento' : 'movimientos'}
                {stockMovements.length > filteredMovements.length ? ' (máx. 300)' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="bg-muted text-xs text-muted-foreground uppercase">
                    <th className="text-left px-4 py-3">Fecha</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Producto</th>
                    <th className="text-right px-4 py-3">Cantidad</th>
                    <th className="text-left px-4 py-3">Origen</th>
                    <th className="text-left px-4 py-3">Operario</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map(m => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(m.createdAtISO).toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${movementBadgeClass(m.type)}`} style={{ fontWeight: 600 }}>
                          {MOVEMENT_LABELS[m.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{productNameMap.get(m.productId) ?? m.productId}</td>
                      <td
                        className={`px-4 py-3 text-sm text-right ${m.quantity < 0 ? 'text-orange-600 dark:text-orange-400' : 'text-[#3d7a3d]'}`}
                        style={{ fontWeight: 600 }}
                      >
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.reference ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.operatorName ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMovements.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  {stockMovements.length === 0
                    ? 'Todavía no hay movimientos registrados. Se irán cargando con cada venta, consumo o pedido recibido.'
                    : 'No hay movimientos para este filtro.'}
                </div>
              )}
            </div>
          </div>
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
            (Stock Actual + Pedidos Pendientes) &lt; Promedio Semanal (según consumo histórico)
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
              {alertProducts.map(({ product: p, weeklyAvg, current, pending }) => (
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
              ))}
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
          <AuditHistoryTable
            entries={stockAuditEntries}
            emptyMessage="Sin registros de cambios en stock"
            showUserAvatar
          />
        </div>
      )}
    </div>
  );
}
