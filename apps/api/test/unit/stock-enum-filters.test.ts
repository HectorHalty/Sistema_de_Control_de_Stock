import { describe, it, expect, vi } from 'vitest';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { StockService } from '../../src/stock/stock.service';
import type { PrismaService } from '../../src/common/prisma.service';

/**
 * Los filtros `type` y `status` llegan como texto crudo desde el query string.
 * Desde que las columnas son enum, un valor fuera del enum que llegue a Prisma
 * lanza PrismaClientValidationError, que el filtro global no traduce y sale 500.
 * El guard tiene que descartarlos antes, incluyendo los nombres heredados de
 * Object.prototype.
 */

const PROTOTYPE_KEYS = ['constructor', 'toString', 'valueOf', 'hasOwnProperty'];

function movementsService() {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = { movimientoStock: { findMany } } as unknown as PrismaService;
  return { service: new StockMovementsService(prisma), findMany };
}

function stockService() {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = { ordenCompra: { findMany } } as unknown as PrismaService;
  return { service: new StockService(prisma), findMany };
}

describe('filtros por enum en stock', () => {
  describe('StockMovementsService.findAll', () => {
    it('acepta un tipo válido y consulta la base', async () => {
      const { service, findMany } = movementsService();
      await service.findAll({ type: 'venta' });
      expect(findMany).toHaveBeenCalledOnce();
      expect(findMany.mock.calls[0][0].where.type).toBe('venta');
    });

    it('descarta un tipo inventado sin consultar la base', async () => {
      const { service, findMany } = movementsService();
      await expect(service.findAll({ type: 'tipo_falso' })).resolves.toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });

    it.each(PROTOTYPE_KEYS)(
      'descarta %s, heredado de Object.prototype, sin consultar la base',
      async key => {
        const { service, findMany } = movementsService();
        await expect(service.findAll({ type: key })).resolves.toEqual([]);
        expect(findMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('StockService.findAllPurchaseOrders', () => {
    it('acepta un estado válido y consulta la base', async () => {
      const { service, findMany } = stockService();
      await service.findAllPurchaseOrders('Pendiente');
      expect(findMany).toHaveBeenCalledOnce();
      expect(findMany.mock.calls[0][0].where.status).toBe('Pendiente');
    });

    it('descarta un estado inventado sin consultar la base', async () => {
      const { service, findMany } = stockService();
      await expect(service.findAllPurchaseOrders('EnCamino')).resolves.toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });

    it.each(PROTOTYPE_KEYS)(
      'descarta %s, heredado de Object.prototype, sin consultar la base',
      async key => {
        const { service, findMany } = stockService();
        await expect(service.findAllPurchaseOrders(key)).resolves.toEqual([]);
        expect(findMany).not.toHaveBeenCalled();
      },
    );

    it('sin estado, consulta sin filtro', async () => {
      const { service, findMany } = stockService();
      await service.findAllPurchaseOrders();
      expect(findMany).toHaveBeenCalledOnce();
      expect(findMany.mock.calls[0][0].where).toBeUndefined();
    });
  });
});
