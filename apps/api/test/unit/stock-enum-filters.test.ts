import { describe, it, expect, vi } from 'vitest';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { StockService } from '../../src/stock/stock.service';
import { KitchenService } from '../../src/kitchen/kitchen.service';
import { OnlineService } from '../../src/online/online.service';
import { SalesService } from '../../src/sales/sales.service';
import { FootballService } from '../../src/football/football.service';
import type { PrismaService } from '../../src/common/prisma.service';
import type { SseService } from '../../src/sse/sse.service';
import type { StockMovementsService as StockMovementsServiceType } from '../../src/stock/stock-movements.service';
import type { ReglamentoEngineService } from '../../src/reglamento/reglamento-engine.service';
import type { SuspensionSyncService } from '../../src/football/suspension-sync.service';

/**
 * Los filtros `type` y `status` llegan como texto crudo desde el query string.
 * Desde que las columnas son enum, un valor fuera del enum que llegue a Prisma
 * lanza PrismaClientValidationError, que el filtro global no traduce y sale 500.
 * El guard (pickEnumValue, en src/common/enum-filter.ts) tiene que descartarlos
 * antes, incluyendo los nombres heredados de Object.prototype.
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

function kitchenService() {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = { ordenCocina: { findMany } } as unknown as PrismaService;
  return { service: new KitchenService(prisma, {} as unknown as SseService), findMany };
}

function onlineService() {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = { pedidoPublico: { findMany } } as unknown as PrismaService;
  return { service: new OnlineService(prisma, {} as unknown as SalesService), findMany };
}

function salesService() {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = { ticketVenta: { findMany } } as unknown as PrismaService;
  return {
    service: new SalesService(prisma, {} as unknown as StockMovementsServiceType),
    findMany,
  };
}

function footballService() {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = { partidoFutbol: { findMany } } as unknown as PrismaService;
  return {
    service: new FootballService(
      prisma,
      {} as unknown as ReglamentoEngineService,
      {} as unknown as SuspensionSyncService,
    ),
    findMany,
  };
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

  describe('KitchenService.findAllOrders', () => {
    it('acepta un estado válido y consulta la base', async () => {
      const { service, findMany } = kitchenService();
      await service.findAllOrders(undefined, 'preparing');
      expect(findMany).toHaveBeenCalledOnce();
      expect(findMany.mock.calls[0][0].where.status).toBe('preparing');
    });

    it('descarta un estado inventado sin consultar la base', async () => {
      const { service, findMany } = kitchenService();
      await expect(service.findAllOrders(undefined, 'en_camino')).resolves.toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });

    it.each(PROTOTYPE_KEYS)(
      'descarta %s, heredado de Object.prototype, sin consultar la base',
      async key => {
        const { service, findMany } = kitchenService();
        await expect(service.findAllOrders(undefined, key)).resolves.toEqual([]);
        expect(findMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('OnlineService.listOrders', () => {
    it('acepta un estado válido y consulta la base', async () => {
      const { service, findMany } = onlineService();
      await service.listOrders('pagado');
      expect(findMany).toHaveBeenCalledOnce();
      expect(findMany.mock.calls[0][0].where.status).toBe('pagado');
    });

    it('descarta un estado inventado sin consultar la base', async () => {
      const { service, findMany } = onlineService();
      await expect(service.listOrders('estado_falso')).resolves.toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });

    it.each(PROTOTYPE_KEYS)(
      'descarta %s, heredado de Object.prototype, sin consultar la base',
      async key => {
        const { service, findMany } = onlineService();
        await expect(service.listOrders(key)).resolves.toEqual([]);
        expect(findMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('SalesService.findAllTickets', () => {
    it('acepta un estado válido y consulta la base', async () => {
      const { service, findMany } = salesService();
      await service.findAllTickets('anulado');
      expect(findMany).toHaveBeenCalledOnce();
      expect(findMany.mock.calls[0][0].where.status).toBe('anulado');
    });

    it('descarta un estado inventado sin consultar la base', async () => {
      const { service, findMany } = salesService();
      await expect(service.findAllTickets('estado_falso')).resolves.toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });

    it.each(PROTOTYPE_KEYS)(
      'descarta %s, heredado de Object.prototype, sin consultar la base',
      async key => {
        const { service, findMany } = salesService();
        await expect(service.findAllTickets(key)).resolves.toEqual([]);
        expect(findMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('FootballService.findAllMatches', () => {
    it('acepta un estado válido y consulta la base', async () => {
      const { service, findMany } = footballService();
      await service.findAllMatches({ status: 'jugado' });
      expect(findMany).toHaveBeenCalledOnce();
      expect(findMany.mock.calls[0][0].where.status).toBe('jugado');
    });

    it('descarta un estado inventado sin consultar la base', async () => {
      const { service, findMany } = footballService();
      await expect(service.findAllMatches({ status: 'estado_falso' })).resolves.toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });

    it.each(PROTOTYPE_KEYS)(
      'descarta %s, heredado de Object.prototype, sin consultar la base',
      async key => {
        const { service, findMany } = footballService();
        await expect(service.findAllMatches({ status: key })).resolves.toEqual([]);
        expect(findMany).not.toHaveBeenCalled();
      },
    );
  });
});
