import type { Product, StockCountSession, StockMovement } from './types';

export interface ReconciliationRow {
  productId: string;
  productName: string;
  unit: 'unidades' | 'kg';
  /** Stock verificado en el control anterior (o derivado si no hay control previo). */
  initial: number;
  /** Entradas por pedidos recibidos en la ventana. */
  entradas: number;
  /** Unidades descontadas por ventas (neto de anulaciones/devoluciones), en positivo. */
  ventas: number;
  /** Unidades descontadas por consumos de empleados, en positivo. */
  consumos: number;
  /** Otros ajustes manuales en la ventana (signado). */
  ajustes: number;
  /** Stock que el sistema esperaba al momento del conteo. */
  expected: number;
  /** Stock contado físicamente. */
  counted: number;
  /** counted - expected. Negativo = faltante; positivo = sobrante. */
  difference: number;
}

export interface ReconciliationTotals {
  expected: number;
  counted: number;
  difference: number;
  faltante: number;
  sobrante: number;
  conDiferencia: number;
}

export interface ReconciliationResult {
  rows: ReconciliationRow[];
  totals: ReconciliationTotals;
  fromISO: string | null;
  toISO: string;
}

/** Ordena las sesiones de control de la más reciente a la más antigua. */
export function sortCountSessionsDesc(sessions: StockCountSession[]): StockCountSession[] {
  return [...sessions].sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
}

/** Devuelve la sesión de control inmediatamente anterior a la indicada. */
export function findPreviousSession(
  sessions: StockCountSession[],
  session: StockCountSession,
): StockCountSession | undefined {
  return sortCountSessionsDesc(sessions).find(s => s.createdAtISO < session.createdAtISO);
}

interface MovementBuckets {
  entradas: number;
  ventas: number;
  consumos: number;
  ajustes: number;
}

function emptyBuckets(): MovementBuckets {
  return { entradas: 0, ventas: 0, consumos: 0, ajustes: 0 };
}

/** Agrupa los movimientos por producto dentro de la ventana (fromISO, toISO]. */
function bucketMovementsByProduct(
  movements: StockMovement[],
  fromISO: string | null,
  toISO: string,
): Map<string, MovementBuckets> {
  const map = new Map<string, MovementBuckets>();

  for (const m of movements) {
    if (m.createdAtISO > toISO) continue;
    if (fromISO !== null && m.createdAtISO <= fromISO) continue;

    const bucket = map.get(m.productId) ?? emptyBuckets();
    switch (m.type) {
      case 'entrada':
        bucket.entradas += Math.abs(m.quantity);
        break;
      case 'venta':
        bucket.ventas += Math.abs(m.quantity);
        break;
      case 'venta_anulada':
      case 'devolucion':
        // Reponen stock: reducen las ventas netas.
        bucket.ventas -= Math.abs(m.quantity);
        break;
      case 'consumo':
        bucket.consumos += Math.abs(m.quantity);
        break;
      case 'ajuste_manual':
        bucket.ajustes += m.quantity;
        break;
    }
    map.set(m.productId, bucket);
  }

  return map;
}

/**
 * Construye la conciliación para una sesión de control de stock comparando el stock
 * esperado por el sistema contra el contado físicamente, desglosando los movimientos
 * (ventas, consumos, entradas) ocurridos desde el control anterior.
 */
export function buildReconciliation(
  session: StockCountSession,
  prevSession: StockCountSession | undefined,
  movements: StockMovement[],
  products: Product[],
): ReconciliationResult {
  const fromISO = prevSession?.createdAtISO ?? null;
  const toISO = session.createdAtISO;

  const buckets = bucketMovementsByProduct(movements, fromISO, toISO);
  const prevCounted = new Map<string, number>(
    (prevSession?.entries ?? []).map(e => [e.productId, e.counted]),
  );
  const productName = new Map(products.map(p => [p.id, p.name]));

  const rows: ReconciliationRow[] = session.entries.map(entry => {
    const b = buckets.get(entry.productId) ?? emptyBuckets();
    const expected = entry.expected;
    const counted = entry.counted;
    // initial = expected - entradas + ventas + consumos - ajustes (despeje de la identidad).
    const initial = prevCounted.has(entry.productId)
      ? (prevCounted.get(entry.productId) as number)
      : expected - b.entradas + b.ventas + b.consumos - b.ajustes;

    return {
      productId: entry.productId,
      productName: productName.get(entry.productId) ?? entry.productName,
      unit: entry.unit,
      initial,
      entradas: b.entradas,
      ventas: b.ventas,
      consumos: b.consumos,
      ajustes: b.ajustes,
      expected,
      counted,
      difference: counted - expected,
    };
  });

  rows.sort(
    (a, b) =>
      Math.abs(b.difference) - Math.abs(a.difference) ||
      a.productName.localeCompare(b.productName, 'es'),
  );

  const totals = rows.reduce<ReconciliationTotals>(
    (acc, r) => {
      acc.expected += r.expected;
      acc.counted += r.counted;
      acc.difference += r.difference;
      if (r.difference < 0) acc.faltante += r.difference;
      if (r.difference > 0) acc.sobrante += r.difference;
      if (r.difference !== 0) acc.conDiferencia += 1;
      return acc;
    },
    { expected: 0, counted: 0, difference: 0, faltante: 0, sobrante: 0, conDiferencia: 0 },
  );

  return { rows, totals, fromISO, toISO };
}
