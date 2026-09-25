import type { StockAdjustmentReason } from '@/features/inventory/types';

export const ADJUSTMENT_REASON_LABELS: Record<StockAdjustmentReason, string> = {
  rotura: 'Rotura',
  vencido: 'Vencido',
  correccion: 'Corrección de carga',
  entrada_directa: 'Entrada directa (sin pedido)',
};

export const ADJUSTMENT_REASONS = Object.keys(ADJUSTMENT_REASON_LABELS) as StockAdjustmentReason[];

export function stockAdjustmentError(input: {
  warehouseId: string;
  quantity: number;
  reason: StockAdjustmentReason | '';
  available: number;
}): string | null {
  if (!input.warehouseId) return 'Elegí el almacén';
  if (!Number.isFinite(input.quantity) || input.quantity === 0) return 'La cantidad no puede ser 0';
  if (input.quantity < 0 && -input.quantity > input.available) {
    return 'No hay stock suficiente en el almacén';
  }
  if (!input.reason) return 'Elegí el motivo del ajuste';
  return null;
}
