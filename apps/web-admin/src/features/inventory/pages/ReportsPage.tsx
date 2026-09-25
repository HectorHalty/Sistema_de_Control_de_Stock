import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/app/providers/AppContext';
import {
  canAccessStockReportTab,
  getDefaultStockReportTab,
  type StockReportTab,
} from '@/features/platform/config/modules';
import { ClipboardCheck, AlertTriangle, Clock, Download, TrendingDown, TrendingUp, ArrowLeftRight, Search } from 'lucide-react';
import { getUnitLabel, stockCountTypeLabel } from '@/app/components/store';
import type { StockMovementType, StockCountSession } from '@/app/components/store';
import { ADJUSTMENT_REASON_LABELS } from '@/features/inventory/stock-adjustment';
import { useSearchParams } from 'react-router';
import { downloadBlobFile } from '@/app/components/download';
import { buildReconciliationXlsx } from '@/app/components/xlsxExport';
import { getStockAuditEntries } from '@/shared/utils/audit-log';
import { selectStockAlerts } from '@/features/inventory/stock-alerts';
import { AuditHistoryTable } from '@/shared/components/AuditHistoryTable';
import { stockApi } from '@/app/api/client';
import { mapApiStockCycleToPayload } from '@/features/inventory/api/inventory-mappers';
import {
  buildStockCycleRows,
  buildStockCycleTotals,
  type StockCyclePayload,
  type StockCycleRow,
  type StockCycleTotals,
} from '@/features/inventory/stock-cycles';

type ReportTab = StockReportTab;

const LIVE_SESSION_ID = 'current';

/** El esperado del control no sale de la cuenta del ciclo: hay que mostrarlo, no taparlo. */
const NO_CIERRA_HINT =
  'La cuenta del ciclo no da el esperado que guardó el control. Casi siempre es un ajuste de corrección de carga.';

function formatSessionLabel(dateStr: string, dateType: StockCountSession['dateType']): string {
  return `${dateStr} · ${stockCountTypeLabel(dateType)}`;
}

function cycleDateLabel(iso: string | null): string {
  if (!iso) return '';
  const instant = new Date(iso);
  return Number.isNaN(instant.getTime()) ? '' : instant.toLocaleDateString('es-AR');
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** De qué control a qué control va lo que está en pantalla. */
function cycleHeadline(payload: StockCyclePayload): string {
  const from = cycleDateLabel(payload.previousCreatedAt);
  const days = `${payload.days} ${plural(payload.days, 'día', 'días')}`;
  const sales = payload.hadSales ? 'con ventas' : 'sin ventas';
  const closing = payload.dateType
    ? `control ${stockCountTypeLabel(payload.dateType)}`
    : 'sin conteo de cierre';
  if (!payload.sessionCreatedAt) {
    const start = from ? `Desde el control del ${from}` : 'Desde el inicio';
    return `${start} hasta ahora · ${days} · ${closing} · ${sales}`;
  }
  const to = cycleDateLabel(payload.sessionCreatedAt);
  if (!from) return `Primer control · hasta el ${to} · ${days} · ${closing} · ${sales}`;
  return `Del ${from} al ${to} · ${days} · ${closing} · ${sales}`;
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** Los totales de las tarjetas son magnitudes: el signo lo pone la etiqueta, y cero no lleva. */
function formatMagnitude(value: number, sign: '+' | '-'): string {
  return value === 0 ? '0' : `${sign}${value}`;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

/**
 * Un ciclo puede cerrar con sobrante: se cuenta más de lo que el libro explica y
 * el consumo real queda negativo. Decir "salieron −10 unidades" no se entiende,
 * así que cada caso tiene su frase.
 */
function cycleTotalsSentence(totals: StockCycleTotals): string {
  const salida =
    totals.consumoReal >= 0
      ? `Salieron ${totals.consumoReal} unidades · el libro explica ${totals.salidas}`
      : `Se contaron ${-totals.consumoReal} unidades más de las que el libro explica`;
  if (totals.diferencia > 0) return `${salida} · quedan ${totals.diferencia} sin explicar`;
  if (totals.diferencia < 0) return `${salida} · sobran ${-totals.diferencia} sin explicar`;
  return `${salida} · el libro explica todo`;
}

/** La diferencia más grande primero: es la que hay que explicar. */
function byDifferenceDesc(a: StockCycleRow, b: StockCycleRow): number {
  return (
    Math.abs(b.diferencia ?? 0) - Math.abs(a.diferencia ?? 0) ||
    a.productName.localeCompare(b.productName, 'es')
  );
}

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  venta: 'Venta',
  venta_anulada: 'Anulación',
  devolucion: 'Devolución',
  consumo: 'Consumo',
  entrada: 'Entrada (pedido)',
  ajuste_manual: 'Ajuste manual',
  diferencia_conteo: 'Diferencia de control',
  pasaje: 'Pasaje entre almacenes',
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
    stockMovements,
    stockCountSessions,
    currentUser,
    stockLowNotifications,
    stockAutoAlerts,
    stockAutoAlertMinimum,
    stockAlertDay,
  } = useAppContext();

  const stockAuditEntries = useMemo(
    () => getStockAuditEntries(auditLog, salesAuditLog),
    [auditLog, salesAuditLog],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<ReportTab>('control');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(LIVE_SESSION_ID);
  // Arranca apagado: el dueño quiere ver todos los productos, no sólo los que fallan.
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<StockMovementType | 'all'>('all');
  const [movementSearch, setMovementSearch] = useState('');

  const tabs: { id: ReportTab; label: string; icon: React.ElementType }[] = [
    { id: 'control', label: 'Control de Stock', icon: ClipboardCheck },
    { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
    { id: 'alertas', label: 'Alertas Semanales', icon: AlertTriangle },
    { id: 'historial', label: 'Historial', icon: Clock },
  ].filter(item => canAccessStockReportTab(currentUser.role, item.id));

  useEffect(() => {
    const qpTab = searchParams.get('tab') as ReportTab | null;
    if (qpTab && canAccessStockReportTab(currentUser.role, qpTab)) {
      setTab(qpTab);
      return;
    }
    if (qpTab === 'control' || qpTab === 'consumo') setTab('control');
    else setTab(getDefaultStockReportTab(currentUser.role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTabAndUrl = (next: ReportTab) => {
    setTab(next);
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const sortedSessions = useMemo(
    () => [...stockCountSessions].sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO)),
    [stockCountSessions],
  );

  const selectedSession = useMemo(
    () => sortedSessions.find(s => s.id === selectedSessionId),
    [sortedSessions, selectedSessionId],
  );

  const isLive = selectedSessionId === LIVE_SESSION_ID;

  // El desglose lo suma el servidor: `GET /stock/movements` corta en 500 filas
  // y cualquier ciclo viejo calculado con lo que tiene el cliente sale en cero.
  // Fuera de `hydrationQueries`: que un ciclo no se pueda leer no significa que
  // el inventario esté offline — mismo criterio que el log de auditoría.
  const cycleQuery = useQuery({
    queryKey: ['inventory', 'cycle', selectedSessionId],
    queryFn: () => stockApi.cycles.get(selectedSessionId).then(mapApiStockCycleToPayload),
  });

  const cycle = cycleQuery.data;

  const cycleRows = useMemo(() => (cycle ? buildStockCycleRows(cycle) : []), [cycle]);
  const cycleTotals = useMemo(() => buildStockCycleTotals(cycleRows), [cycleRows]);

  // Las filas sin contado anterior no tienen ciclo: van aparte, no en cero.
  const sinCicloRows = useMemo(
    () => cycleRows.filter(r => r.sinContadoAnterior).sort((a, b) => a.productName.localeCompare(b.productName, 'es')),
    [cycleRows],
  );

  const visibleRows = useMemo(() => {
    const computable = cycleRows.filter(r => !r.sinContadoAnterior);
    const filtered = !onlyDifferences
      ? computable
      : isLive
        ? computable.filter(r => r.adiciones !== 0 || r.salidas !== 0)
        : computable.filter(r => r.diferencia !== null && r.diferencia !== 0);
    return [...filtered].sort(byDifferenceDesc);
  }, [cycleRows, onlyDifferences, isLive]);

  const conDiferencia = useMemo(
    () => cycleRows.filter(r => r.diferencia !== null && r.diferencia !== 0).length,
    [cycleRows],
  );

  const algunaNoCierra = useMemo(
    () => visibleRows.some(r => r.expected !== null && !r.cierra),
    [visibleRows],
  );

  const cycleCards = useMemo(() => {
    return cycleRows.reduce(
      (acc, r) => ({
        expected: acc.expected + (r.expected ?? 0),
        counted: acc.counted + (r.counted ?? 0),
        ventas: acc.ventas + r.ventas,
        consumos: acc.consumos + r.consumos,
        entradas: acc.entradas + r.entradas,
        roturas: acc.roturas + r.roturas,
        faltante: acc.faltante + Math.max(r.diferencia ?? 0, 0),
        sobrante: acc.sobrante + Math.max(-(r.diferencia ?? 0), 0),
      }),
      { expected: 0, counted: 0, ventas: 0, consumos: 0, entradas: 0, roturas: 0, faltante: 0, sobrante: 0 },
    );
  }, [cycleRows]);

  const downloadReconciliationXlsx = () => {
    if (!cycle) return;
    const title = selectedSession
      ? `Control de Stock · ${formatSessionLabel(selectedSession.date, selectedSession.dateType)}`
      : 'Control de Stock · En curso (sin conteo)';
    const blob = buildReconciliationXlsx({
      title,
      rows: [...visibleRows, ...sinCicloRows].map(r => ({
        product: r.productName,
        initial: r.countedBefore,
        entradas: r.entradas,
        ventas: r.ventas,
        consumos: r.consumos,
        roturas: r.roturas,
        consumoReal: r.consumoReal,
        expected: r.expected,
        counted: r.counted,
        difference: r.diferencia,
        porcentajeDiferencia: r.porcentajeDiferencia,
      })),
    });
    downloadBlobFile({
      filename: `control-stock-${(selectedSession?.createdAtISO ?? new Date().toISOString()).slice(0, 10)}.xlsx`,
      blob,
    });
  };

  const alertProducts = useMemo(
    () => selectStockAlerts({
      products,
      orders,
      movements: stockMovements,
      lowStockNotifications: stockLowNotifications,
      autoAlerts: stockAutoAlerts,
      autoAlertMinimum: stockAutoAlertMinimum,
      alertDay: stockAlertDay,
    }),
    [products, orders, stockMovements, stockLowNotifications, stockAutoAlerts, stockAutoAlertMinimum, stockAlertDay],
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
                    value={selectedSessionId}
                    onChange={e => setSelectedSessionId(e.target.value)}
                    className="px-4 py-2.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
                  >
                    <option value={LIVE_SESSION_ID}>En curso (sin conteo)</option>
                    {sortedSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {formatSessionLabel(s.date, s.dateType)}
                      </option>
                    ))}
                  </select>
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

              {cycleQuery.isPending && (
                <div className="bg-card rounded-xl border border-border p-10 shadow-sm text-center">
                  <p className="text-sm text-muted-foreground">Cargando el ciclo...</p>
                </div>
              )}

              {cycleQuery.isError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  No se pudo leer el ciclo de este control. Probá de nuevo en un momento: sin el dato del servidor no se puede mostrar el desglose.
                </div>
              )}

              {cycle && (
                <>
                  <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    {/* Un ciclo cerrado sin ventas controla un pedido recibido; el abierto todavía no controla nada. */}
                    <h3>{isLive ? 'Ciclo en curso' : cycle.hadSales ? 'Ciclo de stock' : 'Control de recepción'}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{cycleHeadline(cycle)}</p>
                    {!isLive && !cycle.hadSales && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Acá la diferencia habla de lo que entregó el proveedor, no de lo que se fue en el día de venta.
                      </p>
                    )}
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {isLive ? (
                      <>
                        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                          <p className="text-xs text-orange-600 dark:text-orange-400">Vendido (período)</p>
                          <p className="text-xl mt-1 text-orange-600 dark:text-orange-400" style={{ fontWeight: 700 }}>
                            {formatMagnitude(cycleCards.ventas, '-')}
                          </p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                          <p className="text-xs text-purple-600 dark:text-purple-400">Consumido (período)</p>
                          <p className="text-xl mt-1 text-purple-600 dark:text-purple-400" style={{ fontWeight: 700 }}>
                            {formatMagnitude(cycleCards.consumos, '-')}
                          </p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                          <p className="text-xs text-[#3d7a3d]">Ingresado (período)</p>
                          <p className="text-xl mt-1 text-[#3d7a3d]" style={{ fontWeight: 700 }}>
                            {formatMagnitude(cycleCards.entradas, '+')}
                          </p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                          <p className="text-xs text-muted-foreground">Rotura (período)</p>
                          <p className="text-xl mt-1" style={{ fontWeight: 700 }}>
                            {formatMagnitude(cycleCards.roturas, '-')}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                          <p className="text-xs text-muted-foreground">Stock esperado</p>
                          <p className="text-xl mt-1" style={{ fontWeight: 700 }}>{cycleCards.expected}</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                          <p className="text-xs text-muted-foreground">Stock contado</p>
                          <p className="text-xl mt-1" style={{ fontWeight: 700 }}>{cycleCards.counted}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/40 p-4 shadow-sm">
                          <div className="flex items-center gap-1.5">
                            <TrendingDown size={14} className="text-red-600 dark:text-red-400" />
                            <p className="text-xs text-red-700 dark:text-red-300">Faltante</p>
                          </div>
                          <p className="text-xl mt-1 text-red-700 dark:text-red-300" style={{ fontWeight: 700 }}>
                            {formatMagnitude(cycleCards.faltante, '-')}
                          </p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/40 p-4 shadow-sm">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-blue-600 dark:text-blue-400" />
                            <p className="text-xs text-blue-700 dark:text-blue-300">Sobrante</p>
                          </div>
                          <p className="text-xl mt-1 text-blue-700 dark:text-blue-300" style={{ fontWeight: 700 }}>
                            {formatMagnitude(cycleCards.sobrante, '+')}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Reconciliation table */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                      <h3>{isLive ? 'Movimientos desde el último control' : 'Esperado vs. Contado'}</h3>
                      {!isLive && (
                        <span className="text-xs text-muted-foreground">
                          {conDiferencia} con diferencia
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1080px]">
                        <thead>
                          <tr className="bg-muted text-xs text-muted-foreground uppercase">
                            <th className="text-left px-4 py-3">Producto</th>
                            <th className="text-right px-4 py-3">Inicial</th>
                            <th className="text-right px-4 py-3">Entradas</th>
                            <th className="text-right px-4 py-3">Ventas</th>
                            <th className="text-right px-4 py-3">Consumo</th>
                            <th className="text-right px-4 py-3">Rotura</th>
                            <th className="text-right px-4 py-3">Consumo real</th>
                            <th className="text-right px-4 py-3">Esperado</th>
                            <th className="text-right px-4 py-3">Contado</th>
                            <th className="text-right px-4 py-3">Diferencia</th>
                            <th className="text-right px-4 py-3" title="Diferencia sobre el consumo real">Dif. %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map(row => {
                            const u = getUnitLabel(row.unit, true);
                            const noCierra = row.expected !== null && !row.cierra;
                            return (
                              <tr key={row.productId} className="border-b border-border/50">
                                <td className="px-4 py-3 text-sm" style={{ fontWeight: 500 }}>
                                  {row.productName}
                                  {noCierra && (
                                    <span
                                      title={NO_CIERRA_HINT}
                                      className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 align-middle"
                                    >
                                      no cierra
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-muted-foreground">{row.countedBefore}</td>
                                <td className="px-4 py-3 text-sm text-right text-[#3d7a3d]">{row.entradas > 0 ? `+${row.entradas}` : 0}</td>
                                <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">{row.ventas > 0 ? `-${row.ventas}` : 0}</td>
                                <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{row.consumos > 0 ? `-${row.consumos}` : 0}</td>
                                <td className="px-4 py-3 text-sm text-right text-muted-foreground">{row.roturas > 0 ? `-${row.roturas}` : 0}</td>
                                <td className="px-4 py-3 text-sm text-right" style={{ fontWeight: 600 }}>
                                  {row.consumoReal === null ? '—' : row.consumoReal}
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                                  {row.expected === null ? '—' : row.expected}
                                </td>
                                {row.counted === null ? (
                                  <>
                                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">—</td>
                                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">pendiente</td>
                                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">—</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-4 py-3 text-sm text-right" style={{ fontWeight: 600 }}>{row.counted}</td>
                                    <td className="px-4 py-3 text-right">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${(row.diferencia ?? 0) > 0
                                            ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                            : (row.diferencia ?? 0) < 0
                                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                              : 'bg-muted text-muted-foreground'
                                          }`}
                                        style={{ fontWeight: 600 }}
                                      >
                                        {formatSigned(row.diferencia ?? 0)} {u}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                                      {formatPercent(row.porcentajeDiferencia)}
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
                              : 'Este control no tiene productos con ciclo para calcular.'}
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground space-y-1">
                      {/* Sin conteo de cierre nada se puede medir: los totales darían todos cero y se leerían como una respuesta. */}
                      {isLive ? (
                        <p>Todavía sin conteo de cierre: los totales del ciclo salen recién cuando controles el stock.</p>
                      ) : (
                        <>
                          <p>{cycleTotalsSentence(cycleTotals)}</p>
                          {cycleTotals.filasIncompletas > 0 && (
                            <p>
                              {cycleTotals.filasIncompletas}{' '}
                              {plural(cycleTotals.filasIncompletas, 'producto no se pudo calcular', 'productos no se pudieron calcular')}.
                            </p>
                          )}
                        </>
                      )}
                      {algunaNoCierra && <p>{NO_CIERRA_HINT}</p>}
                    </div>
                  </div>

                  {sinCicloRows.length > 0 && (
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b border-border">
                        <h3>Sin ciclo para calcular</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          El control anterior no incluyó estos productos, así que no se sabe de cuánto partieron y el ciclo no se puede calcular.
                        </p>
                      </div>
                      <ul className="divide-y divide-border/50">
                        {sinCicloRows.map(row => (
                          <li key={row.productId} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                            <span style={{ fontWeight: 500 }}>{row.productName}</span>
                            <span className="text-xs text-muted-foreground">
                              Salidas del período: {row.salidas} {getUnitLabel(row.unit, true)}
                              {row.counted !== null ? ` · contado ${row.counted}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
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
              <option value="diferencia_conteo">Diferencias de control</option>
              <option value="pasaje">Pasajes</option>
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
                          {MOVEMENT_LABELS[m.type]}{m.reason ? ` · ${ADJUSTMENT_REASON_LABELS[m.reason]}` : ''}
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
