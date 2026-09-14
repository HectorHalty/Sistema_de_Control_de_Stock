import { describe, it, expect, beforeEach } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { StockService } from '../../src/stock/stock.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { CreateProductDto, CreateCategoryDto, CreateSupplierDto, ReceivePurchaseOrderDto, UpdateProductDto } from '../../src/stock/dto';
import {
  createEmptyStockState,
  createPrismaMock,
  seedBasicCatalog,
} from '../helpers/stock-test-store';

function createStockService(state = createEmptyStockState()) {
  const prisma = createPrismaMock(state);
  const movements = new StockMovementsService(prisma as never);
  const service = new StockService(prisma as never, movements);
  return { service, state, prisma };
}

describe('Catálogo stock — integridad CRUD', () => {
  let service: StockService;
  let state: ReturnType<typeof createEmptyStockState>;

  beforeEach(() => {
    const created = createStockService();
    service = created.service;
    state = created.state;
  });

  it('crea una categoría y sigue listándola', async () => {
    const created = await service.createCategory({ name: 'Lácteos', icon: 'Milk' });
    expect(created.name).toBe('Lácteos');
    const list = await service.findAllCategories();
    expect(list.some(c => c.id === created.id && c.name === 'Lácteos')).toBe(true);
  });

  it('find-or-create: segundo create con el mismo nombre no explota', async () => {
    const first = await service.createCategory({ name: 'Snacks', icon: 'Cookie' });
    const second = await service.createCategory({ name: 'Snacks', icon: 'Cookie' });
    expect(second.id).toBe(first.id);
    expect(state.categories.filter(c => c.name === 'Snacks')).toHaveLength(1);
  });

  it('crea un producto usando la categoría persistida', async () => {
    const cat = await service.createCategory({ name: 'Bebidas' });
    await service.createWarehouse({ name: 'Depósito', location: 'PB' });
    const product = await service.createProduct({
      name: 'Agua',
      code: 'BEB-001',
      categoryId: cat.id,
      unit: 'unidades',
    });
    expect(product.name).toBe('Agua');
    expect(state.products.some(p => p.code === 'BEB-001')).toBe(true);
  });

  it('rechaza categoryId que no es UUID en el DTO', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'X',
      code: 'X-1',
      categoryId: 'cat1777',
    });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'categoryId')).toBe(true);
  });

  it('crea proveedor sin productos y con productIds UUID', async () => {
    seedBasicCatalog(state);
    const empty = await service.createSupplier({ name: 'Distribuidora Norte', productIds: [] });
    expect(empty.name).toBe('Distribuidora Norte');
    const withProducts = await service.createSupplier({
      name: 'Mayorista Sur',
      productIds: [state.products[0].id],
    });
    expect(withProducts.products).toHaveLength(1);
    const listed = await service.findAllSuppliers();
    expect(listed.some(s => s.name === 'Distribuidora Norte')).toBe(true);
  });

  it('rechaza productIds que no son UUID', async () => {
    const dto = plainToInstance(CreateSupplierDto, {
      name: 'X',
      productIds: ['p123'],
    });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'productIds')).toBe(true);
  });

  it('nombre de proveedor duplicado → 409', async () => {
    await service.createSupplier({ name: 'Unico' });
    await expect(service.createSupplier({ name: 'Unico' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('categoría DTO exige nombre', async () => {
    const dto = plainToInstance(CreateCategoryDto, { icon: 'Package' });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'name')).toBe(true);
  });

  it('persiste el icono de la categoría al crear, editar y volver a listar', async () => {
    const created = await service.createCategory({ name: 'Carnes', icon: 'Beef' });
    expect(created.icon).toBe('Beef');
    expect((await service.findAllCategories()).find(c => c.id === created.id)?.icon).toBe('Beef');

    const updated = await service.updateCategory(created.id, { icon: 'Wine' });
    expect(updated.icon).toBe('Wine');
    expect((await service.findAllCategories()).find(c => c.id === created.id)?.icon).toBe('Wine');
  });

  it('persiste el icono del almacén al crear, editar y volver a listar', async () => {
    const created = await service.createWarehouse({
      name: 'Barra Heladera',
      location: 'Salón',
      icon: 'Beer',
    });
    expect(created.icon).toBe('Beer');
    expect((await service.findAllWarehouses()).find(w => w.id === created.id)?.icon).toBe('Beer');

    const updated = await service.updateWarehouse(created.id, { icon: 'Refrigerator' });
    expect(updated.icon).toBe('Refrigerator');
    expect((await service.findAllWarehouses()).find(w => w.id === created.id)?.icon).toBe('Refrigerator');
  });

  it('CRUD almacén + adjust stock y re-lectura', async () => {
    const { catId, p1 } = seedBasicCatalog(state);
    const extra = await service.createWarehouse({ name: 'Barra', location: 'Salón' });
    const level = await service.adjustStock(p1, { warehouseId: extra.id, quantity: 4 });
    expect(Number(level.quantity)).toBe(4);
    const levels = await service.getStockLevels(p1);
    expect(levels.some(l => l.warehouseId === extra.id && Number(l.quantity) === 4)).toBe(true);
    expect(catId).toBeTruthy();
  });

  it('pedido ligado a supplierId real', async () => {
    const { p1 } = seedBasicCatalog(state);
    const supplier = await service.createSupplier({ name: 'Proveedor Pedidos', productIds: [p1] });
    const order = await service.createPurchaseOrder({
      supplierId: supplier.id,
      provider: supplier.name,
      items: [{ productId: p1, quantityOrdered: 6 }],
    });
    expect(order.supplierId).toBe(supplier.id);
    expect(order.status).toBe('Pendiente');
  });

  it('receive DTO rechaza operatorId que no es UUID', async () => {
    const dto = plainToInstance(ReceivePurchaseOrderDto, {
      items: [],
      operatorId: 'Admin',
    });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'operatorId')).toBe(true);
  });

  it('receive DTO acepta omitir operatorId', async () => {
    const dto = plainToInstance(ReceivePurchaseOrderDto, {
      items: [{
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantityReceived: 1,
        allocations: [{ warehouseId: '550e8400-e29b-41d4-a716-446655440001', quantity: 1 }],
      }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('almacén inexistente al borrar → 404', async () => {
    await expect(service.deleteWarehouse('00000000-0000-4000-8000-000000000099')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('limpia description, image y orderUnit al enviar null', async () => {
    const { catId } = seedBasicCatalog(state);
    const created = await service.createProduct({
      name: 'Aceite',
      code: 'ACE-001',
      categoryId: catId,
      description: 'botella',
      orderUnit: 12,
      image: 'aceite.png',
    });
    const cleared = await service.updateProduct(created.id, {
      description: null,
      orderUnit: null,
      image: null,
    });
    expect(cleared.description).toBeNull();
    expect(cleared.orderUnit).toBeNull();
    expect(cleared.image).toBeNull();
  });

  it('UpdateProductDto acepta null en campos opcionales', async () => {
    const dto = plainToInstance(UpdateProductDto, { description: null, orderUnit: null, image: null });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('PUT de pedido cambia quantityOrdered, agrega y quita ítems', async () => {
    const { p1, p2 } = seedBasicCatalog(state);
    const order = await service.createPurchaseOrder({
      provider: 'Mayorista',
      items: [{ productId: p1, quantityOrdered: 6 }],
    });
    const updated = await service.updatePurchaseOrder(order.id, {
      items: [
        { productId: p1, quantityOrdered: 10 },
        { productId: p2, quantityOrdered: 3 },
      ],
    });
    expect(updated.items).toHaveLength(2);
    expect(Number(updated.items.find(i => i.productId === p1)?.quantityOrdered)).toBe(10);
    expect(Number(updated.items.find(i => i.productId === p2)?.quantityOrdered)).toBe(3);

    const trimmed = await service.updatePurchaseOrder(order.id, {
      items: [{ productId: p2, quantityOrdered: 4 }],
    });
    expect(trimmed.items).toHaveLength(1);
    expect(trimmed.items[0].productId).toBe(p2);
  });

  it('rechaza editar un pedido ya recibido', async () => {
    const { p1, whId } = seedBasicCatalog(state);
    const order = await service.createPurchaseOrder({
      provider: 'Mayorista',
      items: [{ productId: p1, quantityOrdered: 2 }],
    });
    await service.receivePurchaseOrder(order.id, {
      items: [{ productId: p1, quantityReceived: 2, allocations: [{ warehouseId: whId, quantity: 2 }] }],
    });
    await expect(
      service.updatePurchaseOrder(order.id, { items: [{ productId: p1, quantityOrdered: 9 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('receive rechaza cantidad mayor a lo pedido y recepción incompleta', async () => {
    const { p1, p2, whId } = seedBasicCatalog(state);
    const order = await service.createPurchaseOrder({
      provider: 'Mayorista',
      items: [
        { productId: p1, quantityOrdered: 2 },
        { productId: p2, quantityOrdered: 2 },
      ],
    });
    await expect(
      service.receivePurchaseOrder(order.id, {
        items: [{ productId: p1, quantityReceived: 3, allocations: [{ warehouseId: whId, quantity: 3 }] }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.receivePurchaseOrder(order.id, {
        items: [{ productId: p1, quantityReceived: 2, allocations: [{ warehouseId: whId, quantity: 2 }] }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('round-trip: crear, editar cada campo, vaciar opcionales y releer', async () => {
    const category = await service.createCategory({ name: 'RoundTripCat', icon: 'Package' });
    const warehouse = await service.createWarehouse({ name: 'RoundTripDep', location: 'Fondo', icon: 'Warehouse' });
    const product = await service.createProduct({
      name: 'RoundTripProd',
      code: 'RT-001',
      categoryId: category.id,
      description: 'desc',
      orderUnit: 6,
      image: 'img.png',
      unit: 'cajas',
    });
    const supplier = await service.createSupplier({ name: 'RoundTripProv', productIds: [product.id] });

    const editedCat = await service.updateCategory(category.id, { name: 'RoundTripCat2', icon: 'Milk' });
    const editedWh = await service.updateWarehouse(warehouse.id, { location: 'Barra', icon: 'Beer' });
    const editedProd = await service.updateProduct(product.id, { name: 'RoundTripProd2', unit: 'unidades' });
    const editedSup = await service.updateSupplier(supplier.id, { name: 'RoundTripProv2' });

    expect((await service.findAllCategories()).find(c => c.id === category.id)).toMatchObject({
      name: editedCat.name,
      icon: 'Milk',
    });
    expect((await service.findAllWarehouses()).find(w => w.id === warehouse.id)).toMatchObject({
      location: 'Barra',
      icon: 'Beer',
    });
    const rereadProd = await service.findProductById(product.id);
    expect(rereadProd.name).toBe(editedProd.name);
    expect(rereadProd.unit).toBe('unidades');
    expect((await service.findAllSuppliers()).find(s => s.id === supplier.id)?.name).toBe(editedSup.name);

    const cleared = await service.updateProduct(product.id, { description: null, image: null, orderUnit: null });
    const afterClear = await service.findProductById(product.id);
    expect(afterClear.description).toBeNull();
    expect(afterClear.image).toBeNull();
    expect(afterClear.orderUnit).toBeNull();
    expect(cleared.description).toBeNull();

    const order = await service.createPurchaseOrder({
      supplierId: supplier.id,
      provider: editedSup.name,
      items: [{ productId: product.id, quantityOrdered: 2 }],
    });
    const editedOrder = await service.updatePurchaseOrder(order.id, {
      items: [{ productId: product.id, quantityOrdered: 8 }],
    });
    const rereadOrder = await service.findPurchaseOrderById(order.id);
    expect(Number(rereadOrder.items[0].quantityOrdered)).toBe(8);
    expect(Number(editedOrder.items[0].quantityOrdered)).toBe(8);
  });
});
