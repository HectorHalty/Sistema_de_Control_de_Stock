import type { StockCountSession } from './types';
import { roundUpToOrderUnit } from './types';

export type SuggestionSpan = 'week' | 'month' | 'quarter' | 'halfYear';

const SPAN_DAYS: Record<SuggestionSpan, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  halfYear: 180,
};

const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';

export function calendarDayInArgentina(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Día calendario de una sesión. Si el texto empieza con YYYY-MM-DD, esos
 * diez caracteres mandan: un control del 2026-09-23 no pasa al día UTC
 * anterior. Si no, se interpreta el instante en Argentina.
 */
export function sessionCalendarDay(date: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(date.trim());
  if (match) return match[1];
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return calendarDayInArgentina(parsed);
}

function addCalendarDays(isoDate: string, delta: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function suggestFromStockCounts(input: {
  sessions: StockCountSession[];
  productId: string;
  currentStock: number;
  orderUnit?: number;
  dateType: 'regular' | 'after';
  span: SuggestionSpan;
  specificDate?: string;
  packRounding: boolean;
  today: string;
}): { raw: number; suggested: number } {
  const specific = input.specificDate ? sessionCalendarDay(input.specificDate) : '';
  const windowStart = specific
    ? specific
    : addCalendarDays(input.today, -(SPAN_DAYS[input.span] - 1));
  const windowEnd = specific || input.today;

  let consumedSum = 0;
  let sessionCount = 0;
  for (const session of input.sessions) {
    if (session.dateType !== input.dateType) continue;
    const day = sessionCalendarDay(session.date);
    if (!day || day < windowStart || day > windowEnd) continue;
    const entry = session.entries.find(item => item.productId === input.productId);
    if (!entry) continue;
    consumedSum += entry.expected - entry.counted;
    sessionCount += 1;
  }

  const average = sessionCount === 0 ? 0 : consumedSum / sessionCount;
  const raw = round3(average - input.currentStock);
  if (raw <= 0) return { raw, suggested: 0 };
  const suggested = input.packRounding
    ? roundUpToOrderUnit(raw, input.orderUnit)
    : raw;
  return { raw, suggested };
}
