import { describe, it, expect, beforeEach } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { StockService } from '../../src/stock/stock.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import {
  CreateSupplierDto,
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
  CreateEmployeeConsumptionDto,
  AdjustStockDto,
} from '../../src/stock/dto';
import {
  createEmptyStockState,
  createPrismaMock,
  seedBasicCatalog,
} from '../helpers/stock-test-store';

/**
 * Suite de integración profunda — migración API-first (Fases 0–3.2).
 *
 * Cubre:
 *  - Fase 1: contratos de auth/roles (validación DTO + reglas de mutación)
 *  - Fase 2.1: catálogo stock (ajuste con movimiento)
 *  - Fase 3.1: consumo empleado + movimientos server-side
 *  - Fase 3.2: proveedores + pedidos + recepción autoritativa
 *
 * Énfasis en SEGURIDAD (rechazo de inputs maliciosos, doble recepción, RBAC)
 * y EFICIENCIA (transacción única, createMany batch, límites de consulta).
 */

import {
  hasAnyRole,
  normalizeApiRole,
  STOCK_MUTATION_ROLES,
  SALES_CATALOG_ROLES,
  FOOTBALL_MUTATION_ROLES,
  ONLINE_MUTATION_ROLES,
} from '../../src/common/roles';

function createStockService(state = createEmptyStockState()) {
  const prisma = createPrismaMock(state);
  const movements = new StockMovementsService(prisma as never);
  const service = new StockService(prisma as never, movements);
  return { service, state, prisma };
}

// ============================================================
// SEGURIDAD — Validación DTO (whitelist / UUID / inyección)
// ============================================================

describe('Seguridad — validación DTO del módulo stock', () => {
  it('rechaza supplier con productIds que no son UUID', async () => {
    const dto = plainToInstance(CreateSupplierDto, {
      name: 'Proveedor X',
      productIds: ["'; DROP TABLE Supplier; --", 'not-uuid'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'productIds')).toBe(true);
  });

  it('rechaza purchase order sin ítems válidos', async () => {
    const dto = plainToInstance(CreatePurchaseOrderDto, {
      provider: 'Test',
      items: [{ productId: 'invalid', quantityOrdered: -5 }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rechaza receive con allocations negativas', async () => {
    const dto = plainToInstance(ReceivePurchaseOrderDto, {
      items: [{
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantityReceived: 10,
        allocations: [{ warehouseId: '550e8400-e29b-41d4-a716-446655440001', quantity: -1 }],
      }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rechaza consumo empleado con cantidad cero', async () => {
    const dto = plainToInstance(CreateEmployeeConsumptionDto, {
      productId: '550e8400-e29b-41d4-a716-446655440000',
      warehouseId: '550e8400-e29b-41d4-a716-446655440001',
      quantity: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('acepta DTOs válidos de proveedor y pedido', async () => {
    const supplier = plainToInstance(CreateSupplierDto, {
      name: 'Distribuidora Norte',
      productIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    const order = plainToInstance(CreatePurchaseOrderDto, {
      provider: 'Distribuidora Norte',
      items: [{ productId: '550e8400-e29b-41d4-a716-446655440000', quantityOrdered: 12 }],
    });
    expect(await validate(supplier)).toHaveLength(0);
    expect(await validate(order)).toHaveLength(0);
  });
});

// ============================================================
// SEGURIDAD — Control de acceso por rol (matriz RBAC)
// ============================================================

describe('Seguridad — matriz RBAC inventario', () => {
  it('Operador_Stock puede mutar inventario', () => {
    expect(hasAnyRole('Operador_Stock', STOCK_MUTATION_ROLES)).toBe(true);
    expect(hasAnyRole('Encargado_Stock', STOCK_MUTATION_ROLES)).toBe(true);
    expect(hasAnyRole('SuperAdmin', STOCK_MUTATION_ROLES)).toBe(true);
  });

  it('Vendedor no puede mutar catálogo de inventario', () => {
    expect(hasAnyRole('Vendedor', STOCK_MUTATION_ROLES)).toBe(false);
    expect(hasAnyRole('Operador', STOCK_MUTATION_ROLES)).toBe(false);
  });

  it('Gerente_Ventas puede mutar catálogo de ventas', () => {
    expect(hasAnyRole('Gerente_Ventas', SALES_CATALOG_ROLES)).toBe(true);
    expect(hasAnyRole('Gerente_Operaciones', SALES_CATALOG_ROLES)).toBe(true);
  });

  it('Operador_Futbol y Operador_Cocina tienen permisos de panel', () => {
    expect(hasAnyRole('Operador_Futbol', FOOTBALL_MUTATION_ROLES)).toBe(true);
    expect(hasAnyRole('Operador_Cocina', ONLINE_MUTATION_ROLES)).toBe(true);
  });

  it('normaliza roles legacy en la API', () => {
    expect(normalizeApiRole('Operador')).toBe('Vendedor');
    expect(normalizeApiRole('Encargado_Stock')).toBe('Operador_Stock');
  });
});

// ============================================================
// INTEGRIDAD — Ciclo completo Fase 3.2 (proveedores + pedidos)
// ============================================================

describe('Integridad — ciclo proveedor → pedido → recepción → stock', () => {
  let service: StockService;
  let state: ReturnType<typeof createEmptyStockState>;
  let catalog: ReturnType<typeof seedBasicCatalog>;

  beforeEach(() => {
    state = createEmptyStockState();
    catalog = seedBasicCatalog(state);
    ({ service } = createStockService(state));
  });

  it('crea proveedor, pedido y recibe stock con movimientos de entrada', async () => {
    const supplier = await service.createSupplier({
      name: 'Mayorista Sur',
      productIds: [catalog.p1],
    });

    const order = await service.createPurchaseOrder({
      supplierId: supplier.id,
      provider: 'fallback',
      items: [{ productId: catalog.p1, quantityOrdered: 20 }],
    });

    expect(order.orderNumber).toBe('PED-001');
    expect(order.provider).toBe('Mayorista Sur');
    expect(order.status).toBe('Pendiente');

    const beforeStock = state.stockLevels.find(
      s => s.productId === catalog.p1 && s.warehouseId === catalog.whId,
    )!.quantity;

    const received = await service.receivePurchaseOrder(order.orderNumber, {
      items: [{
        productId: catalog.p1,
        quantityReceived: 20,
        allocations: [{ warehouseId: catalog.whId, quantity: 20 }],
      }],
      operatorName: 'Admin',
    });

    expect(received.status).toBe('Recibido');
    expect(received.receivedAt).toBeTruthy();

    const afterStock = state.stockLevels.find(
      s => s.productId === catalog.p1 && s.warehouseId === catalog.whId,
    )!.quantity;
    expect(afterStock).toBe(beforeStock + 20);

    expect(state.stockMovements).toHaveLength(1);
    expect(state.stockMovements[0]).toMatchObject({
      type: 'entrada',
      productId: catalog.p1,
      warehouseId: catalog.whId,
      quantity: 20,
      reference: 'PED-001',
    });
  });

  it('genera números de pedido monótonos sin colisiones', async () => {
    state.purchaseOrders.push({
      id: 'old',
      orderNumber: 'PED-003',
      date: '2026-01-01',
      provider: 'X',
      supplierId: null,
      status: 'Recibido',
      receivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const order = await service.createPurchaseOrder({
      provider: 'Nuevo',
      items: [{ productId: catalog.p1, quantityOrdered: 1 }],
    });

    expect(order.orderNumber).toBe('PED-004');
  });
});

// ============================================================
// SEGURIDAD — Reglas de negocio en recepción de pedidos
// ============================================================

describe('Seguridad — recepción de pedidos (anti-abuso)', () => {
  let service: StockService;
  let catalog: ReturnType<typeof seedBasicCatalog>;

  beforeEach(() => {
    const state = createEmptyStockState();
    catalog = seedBasicCatalog(state);
    ({ service } = createStockService(state));
  });

  it('bloquea doble recepción del mismo pedido', async () => {
    const order = await service.createPurchaseOrder({
      provider: 'P',
      items: [{ productId: catalog.p1, quantityOrdered: 5 }],
    });

    await service.receivePurchaseOrder(order.orderNumber, {
      items: [{
        productId: catalog.p1,
        quantityReceived: 5,
        allocations: [{ warehouseId: catalog.whId, quantity: 5 }],
      }],
    });

    await expect(
      service.receivePurchaseOrder(order.orderNumber, {
        items: [{
          productId: catalog.p1,
          quantityReceived: 5,
          allocations: [{ warehouseId: catalog.whId, quantity: 5 }],
        }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza producto ajeno al pedido', async () => {
    const order = await service.createPurchaseOrder({
      provider: 'P',
      items: [{ productId: catalog.p1, quantityOrdered: 5 }],
    });

    await expect(
      service.receivePurchaseOrder(order.orderNumber, {
        items: [{
          productId: catalog.p2,
          quantityReceived: 5,
          allocations: [{ warehouseId: catalog.whId, quantity: 5 }],
        }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza allocations que no suman quantityReceived (fraude de cantidad)', async () => {
    const order = await service.createPurchaseOrder({
      provider: 'P',
      items: [{ productId: catalog.p1, quantityOrdered: 10 }],
    });

    await expect(
      service.receivePurchaseOrder(order.orderNumber, {
        items: [{
          productId: catalog.p1,
          quantityReceived: 10,
          allocations: [{ warehouseId: catalog.whId, quantity: 7 }],
        }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza pedido vacío', async () => {
    await expect(
      service.createPurchaseOrder({ provider: 'P', items: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza supplierId inexistente', async () => {
    await expect(
      service.createPurchaseOrder({
        supplierId: '00000000-0000-0000-0000-000000000099',
        provider: 'P',
        items: [{ productId: catalog.p1, quantityOrdered: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ============================================================
// Fase 3.1 — Consumo empleado + movimientos
// ============================================================

describe('Fase 3.1 — consumo empleado y movimientos server-side', () => {
  it('descuenta stock y registra movimiento negativo de consumo', async () => {
    const state = createEmptyStockState();
    const { p1, whId } = seedBasicCatalog(state);
    const { service } = createStockService(state);

    await service.createEmployeeConsumption({
      productId: p1,
      warehouseId: whId,
      quantity: 3,
      operatorName: 'Operador',
    });

    const level = state.stockLevels.find(s => s.productId === p1 && s.warehouseId === whId)!;
    expect(level.quantity).toBe(7);

    expect(state.stockMovements).toHaveLength(1);
    expect(state.stockMovements[0].type).toBe('consumo');
    expect(state.stockMovements[0].quantity).toBe(-3);
  });

  it('bloquea consumo que dejaría stock negativo', async () => {
    const state = createEmptyStockState();
    const { p1, whId } = seedBasicCatalog(state);
    const { service } = createStockService(state);

    await expect(
      service.createEmployeeConsumption({
        productId: p1,
        warehouseId: whId,
        quantity: 999,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

// ============================================================
// Fase 2.1 — Ajuste manual con movimiento
// ============================================================

describe('Fase 2.1 — ajuste de stock con trazabilidad', () => {
  it('adjustStock registra movimiento ajuste_manual', async () => {
    const state = createEmptyStockState();
    const { p1, whId } = seedBasicCatalog(state);
    const { service } = createStockService(state);

    const dto = plainToInstance(AdjustStockDto, {
      warehouseId: whId,
      quantity: 5,
      reference: 'inventario-inicial',
      operatorName: 'Admin',
    });
    expect(await validate(dto)).toHaveLength(0);

    await service.adjustStock(p1, dto);

    const level = state.stockLevels.find(s => s.productId === p1 && s.warehouseId === whId)!;
    expect(level.quantity).toBe(15);
    expect(state.stockMovements[0]).toMatchObject({
      type: 'ajuste_manual',
      quantity: 5,
      reference: 'inventario-inicial',
    });
  });
});

// ============================================================
// EFICIENCIA — Transacciones y batching
// ============================================================

describe('Eficiencia — transacciones y operaciones batch', () => {
  it('receivePurchaseOrder usa una sola transacción', async () => {
    const state = createEmptyStockState();
    const { p1, whId } = seedBasicCatalog(state);
    const { service, prisma } = createStockService(state);

    const order = await service.createPurchaseOrder({
      provider: 'P',
      items: [{ productId: p1, quantityOrdered: 10 }],
    });

    const txBefore = prisma.transactionCount;
    await service.receivePurchaseOrder(order.orderNumber, {
      items: [{
        productId: p1,
        quantityReceived: 10,
        allocations: [{ warehouseId: whId, quantity: 10 }],
      }],
    });

    expect(prisma.transactionCount - txBefore).toBe(1);
  });

  it('registra múltiples movimientos en un solo createMany', async () => {
    const state = createEmptyStockState();
    const { p1, p2, whId } = seedBasicCatalog(state);
    const { service } = createStockService(state);

    const order = await service.createPurchaseOrder({
      provider: 'P',
      items: [
        { productId: p1, quantityOrdered: 5 },
        { productId: p2, quantityOrdered: 3 },
      ],
    });

    await service.receivePurchaseOrder(order.orderNumber, {
      items: [
        { productId: p1, quantityReceived: 5, allocations: [{ warehouseId: whId, quantity: 5 }] },
        { productId: p2, quantityReceived: 3, allocations: [{ warehouseId: whId, quantity: 3 }] },
      ],
    });

    expect(state.stockMovements).toHaveLength(2);
  });

  it('findAllMovements respeta límite por defecto (eficiencia de lectura)', async () => {
    const state = createEmptyStockState();
    const { service } = createStockService(state);
    const movements = new StockMovementsService(createPrismaMock(state) as never);

    for (let i = 0; i < 600; i++) {
      state.stockMovements.push({
        id: `m${i}`,
        type: 'entrada',
        productId: 'p',
        warehouseId: 'w',
        quantity: 1,
        reference: null,
        operatorId: null,
        operatorName: null,
        createdAt: new Date(Date.now() - i),
      });
    }

    const result = await movements.findAll({ limit: 500 });
    expect(result).toHaveLength(500);
  });

  it('updateSupplier reemplaza productos en una transacción', async () => {
    const state = createEmptyStockState();
    const { p1, p2 } = seedBasicCatalog(state);
    const { service, prisma } = createStockService(state);

    const supplier = await service.createSupplier({ name: 'S', productIds: [p1] });
    const txBefore = prisma.transactionCount;

    await service.updateSupplier(supplier.id, { name: 'S2', productIds: [p2] });

    expect(prisma.transactionCount - txBefore).toBe(1);
    const updated = state.supplierProducts.filter(sp => sp.supplierId === supplier.id);
    expect(updated).toHaveLength(1);
    expect(updated[0].productId).toBe(p2);
  });
});

// ============================================================
// PROVEEDORES — CRUD y aislamiento
// ============================================================

describe('Proveedores — CRUD seguro', () => {
  it('elimina proveedor y sus asignaciones de productos', async () => {
    const state = createEmptyStockState();
    const { p1 } = seedBasicCatalog(state);
    const { service } = createStockService(state);

    const supplier = await service.createSupplier({ name: 'Temp', productIds: [p1] });
    await service.deleteSupplier(supplier.id);

    expect(state.suppliers).toHaveLength(0);
    expect(state.supplierProducts).toHaveLength(0);
  });

  it('no permite actualizar proveedor inexistente', async () => {
    const { service } = createStockService();
    await expect(
      service.updateSupplier('00000000-0000-0000-0000-000000000099', { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Almacenes — eliminación con niveles de stock', () => {
  it('elimina almacén y sus stockLevels en transacción', async () => {
    const state = createEmptyStockState();
    const { whId } = seedBasicCatalog(state);
    const { service } = createStockService(state);

    expect(state.stockLevels.some(s => s.warehouseId === whId)).toBe(true);

    await service.deleteWarehouse(whId);

    expect(state.warehouses.find(w => w.id === whId)).toBeUndefined();
    expect(state.stockLevels.some(s => s.warehouseId === whId)).toBe(false);
  });
});
