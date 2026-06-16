import { describe, expect, it } from 'vitest';
import type { SalesProduct as ApiSalesProduct, Kitchen as ApiKitchen } from '@/app/api/client';
import { mapApiSalesProductToLocal, mapApiKitchenToLocal } from '@/features/sales/api/sales-mappers';

describe('mapApiSalesProductToLocal', () => {
  it('aplana la receta a {stockProductId, quantity} y coacciona price/emoji', () => {
    const api = {
      id: 'sp-1',
      name: 'Hamburguesa',
      category: 'Comidas',
      kitchenId: 'k-1',
      price: '3500.00',
      emoji: undefined,
      active: true,
      recipe: [
        { id: 'r1', stockProductId: 'prod-a', quantity: 1, stockProduct: { id: 'prod-a' } },
        { id: 'r2', stockProductId: 'prod-b', quantity: 2 },
      ],
    } as unknown as ApiSalesProduct;

    const local = mapApiSalesProductToLocal(api);

    expect(local).toEqual({
      id: 'sp-1',
      name: 'Hamburguesa',
      category: 'Comidas',
      kitchenId: 'k-1',
      price: 3500,
      emoji: '',
      active: true,
      recipe: [
        { stockProductId: 'prod-a', quantity: 1 },
        { stockProductId: 'prod-b', quantity: 2 },
      ],
    });
  });

  it('tolera receta ausente', () => {
    const api = {
      id: 'sp-2', name: 'Agua', category: 'Bebidas', kitchenId: 'k-2', price: 1000, active: true,
    } as unknown as ApiSalesProduct;
    expect(mapApiSalesProductToLocal(api).recipe).toEqual([]);
  });
});

describe('mapApiKitchenToLocal', () => {
  it('aplica emoji por defecto cuando falta', () => {
    const api = { id: 'k', name: 'Parrilla', active: true } as ApiKitchen;
    expect(mapApiKitchenToLocal(api)).toEqual({ id: 'k', name: 'Parrilla', emoji: '🍽️', active: true });
  });
});
