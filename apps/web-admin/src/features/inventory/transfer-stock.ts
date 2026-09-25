export function transferStockError(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  available: number;
}): string | null {
  if (!input.fromWarehouseId || !input.toWarehouseId) return 'Elegí origen y destino';
  if (input.fromWarehouseId === input.toWarehouseId) return 'El origen y el destino tienen que ser distintos';
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return 'La cantidad tiene que ser mayor a 0';
  if (input.quantity > input.available) return 'No hay stock suficiente en el almacén de origen';
  return null;
}
