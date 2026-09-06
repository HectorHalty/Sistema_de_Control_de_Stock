import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpsertConfigDto, CreatePrinterDto, CreateSalesCategoryDto } from '../../src/settings/dto';
import { UpdateProductDto, UpdatePurchaseOrderDto } from '../../src/stock/dto';
import { UpdateSalesProductDto } from '../../src/sales/dto';

describe('Contrato persistencia admin', () => {
  it('config DTO exige key y scope', async () => {
    const dto = plainToInstance(UpsertConfigDto, { value: true });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'key')).toBe(true);
    expect(errors.some(e => e.property === 'scope')).toBe(true);
  });

  it('impresora y categoría de venta validan campos mínimos', async () => {
    const printer = plainToInstance(CreatePrinterDto, { name: 'Mostrador', type: 'Mostrador', ip: '10.0.0.8' });
    expect(await validate(printer)).toHaveLength(0);
    const cat = plainToInstance(CreateSalesCategoryDto, { name: 'Pizzas', emoji: '🍕' });
    expect(await validate(cat)).toHaveLength(0);
  });

  it('UpdatePurchaseOrderDto acepta items', async () => {
    const dto = plainToInstance(UpdatePurchaseOrderDto, {
      items: [{ productId: '550e8400-e29b-41d4-a716-446655440000', quantityOrdered: 4 }],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('UpdateProductDto acepta null', async () => {
    const dto = plainToInstance(UpdateProductDto, { description: null, orderUnit: null, image: null });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('UpdateSalesProductDto exige UUID de cocina', async () => {
    const dto = plainToInstance(UpdateSalesProductDto, { kitchenId: 'local-k' });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'kitchenId')).toBe(true);
  });
});
