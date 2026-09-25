/**
 * Antigüedad del último control físico de un producto.
 *
 * El stock del sistema es una estimación: las ventas lo descuentan por ticket y
 * todo lo que sale sin ticket lo deja alto. El único momento en que el número
 * es cierto es justo después de un conteo, así que un stock controlado ayer y
 * uno controlado en julio no valen lo mismo. Módulo puro: sin React ni reloj.
 */
import type { StockCountSession } from './types';
import { stockCycleDay } from './stock-cycles';

/** Lo que se muestra cuando el producto nunca entró en un control. */
export const SIN_CONTROL_LABEL = 'sin control';

/**
 * Día calendario (Argentina) de un control. Se delega en `stockCycleDay`
 * porque `date` es texto libre: los controles cargados desde la pantalla
 * guardan `25/9/2026 13:12`, que no se puede parsear.
 */
export function countSessionDay(session: StockCountSession): string {
  return stockCycleDay({
    sessionDate: session.date,
    sessionCreatedAt: session.createdAtISO,
  });
}

/**
 * El control más reciente que incluyó al producto, o null si nunca lo contaron.
 * Se compara por día calendario y, a igual día, por el instante de guardado.
 */
export function findLastCountSession(
  sessions: StockCountSession[],
  productId: string,
): StockCountSession | null {
  let best: StockCountSession | null = null;
  let bestDay = '';
  for (const session of sessions) {
    if (!session.entries.some(entry => entry.productId === productId)) continue;
    const day = countSessionDay(session);
    if (!day) continue;
    if (
      best === null ||
      day > bestDay ||
      (day === bestDay && session.createdAtISO > best.createdAtISO)
    ) {
      best = session;
      bestDay = day;
    }
  }
  return best;
}

function daysBetween(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const start = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const end = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((end - start) / 86_400_000);
}

/**
 * Antigüedad del último control, en días calendario de Argentina y no en horas
 * transcurridas: un conteo de ayer a las 23:00 es `ayer`, no `hoy`.
 *
 * `today` se inyecta (día `YYYY-MM-DD` en Argentina, como en
 * `suggestFromStockCycles`) para que no dependa del reloj.
 */
export function lastCountAgeLabel(input: {
  sessions: StockCountSession[];
  productId: string;
  today: string;
}): string {
  const session = findLastCountSession(input.sessions, input.productId);
  if (!session) return SIN_CONTROL_LABEL;
  const day = countSessionDay(session);
  if (!day) return SIN_CONTROL_LABEL;
  const age = daysBetween(day, input.today);
  if (age <= 0) return 'hoy';
  if (age === 1) return 'ayer';
  return `hace ${age} días`;
}
