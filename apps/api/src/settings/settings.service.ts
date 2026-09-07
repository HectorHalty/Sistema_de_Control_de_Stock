import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, EstadoMesa, EstadoCuentaEquipo } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  CreateAuditDto,
  CreatePrinterDto,
  CreateSalesCategoryDto,
  CreateTableDto,
  CreateTeamAccountDto,
  UpdatePrinterDto,
  UpdateSalesCategoryDto,
  UpdateTableDto,
  UpdateTeamAccountDto,
  UpsertConfigDto,
} from './dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  listConfig(scope?: string) {
    return this.prisma.configuracion.findMany({
      where: scope ? { scope } : undefined,
      orderBy: { key: 'asc' },
    });
  }

  upsertConfig(dto: UpsertConfigDto) {
    return this.prisma.configuracion.upsert({
      where: { key: dto.key },
      create: { key: dto.key, scope: dto.scope, value: dto.value as Prisma.InputJsonValue },
      update: { scope: dto.scope, value: dto.value as Prisma.InputJsonValue },
    });
  }

  listSalesCategories() {
    return this.prisma.categoriaVenta.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  createSalesCategory(dto: CreateSalesCategoryDto) {
    return this.prisma.categoriaVenta.create({
      data: { name: dto.name.trim(), emoji: dto.emoji || '🍽️', sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async updateSalesCategory(id: string, dto: UpdateSalesCategoryDto) {
    await this.require(this.prisma.categoriaVenta.findUnique({ where: { id } }), 'Categoría');
    return this.prisma.categoriaVenta.update({ where: { id }, data: dto });
  }

  async deleteSalesCategory(id: string) {
    await this.require(this.prisma.categoriaVenta.findUnique({ where: { id } }), 'Categoría');
    return this.prisma.categoriaVenta.delete({ where: { id } });
  }

  listPrinters() {
    return this.prisma.impresora.findMany({ orderBy: { name: 'asc' } });
  }

  async createPrinter(dto: CreatePrinterDto) {
    if (dto.isDefault) {
      await this.prisma.impresora.updateMany({ data: { isDefault: false } });
    }
    return this.prisma.impresora.create({
      data: {
        name: dto.name,
        type: dto.type,
        ip: dto.ip,
        port: dto.port ?? 9100,
        paperWidth: dto.paperWidth ?? 80,
        connected: dto.connected ?? true,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updatePrinter(id: string, dto: UpdatePrinterDto) {
    await this.require(this.prisma.impresora.findUnique({ where: { id } }), 'Impresora');
    if (dto.isDefault) {
      await this.prisma.impresora.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    }
    return this.prisma.impresora.update({ where: { id }, data: dto });
  }

  async deletePrinter(id: string) {
    await this.require(this.prisma.impresora.findUnique({ where: { id } }), 'Impresora');
    return this.prisma.impresora.delete({ where: { id } });
  }

  listTables() {
    return this.prisma.mesaVenta.findMany({ orderBy: { name: 'asc' } });
  }

  createTable(dto: CreateTableDto) {
    return this.prisma.mesaVenta.create({
      data: {
        name: dto.name,
        status: (dto.status as EstadoMesa) ?? 'libre',
        currentOrderId: dto.currentOrderId ?? null,
      },
    });
  }

  async updateTable(id: string, dto: UpdateTableDto) {
    await this.require(this.prisma.mesaVenta.findUnique({ where: { id } }), 'Mesa');
    return this.prisma.mesaVenta.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status as EstadoMesa } : {}),
        ...(dto.currentOrderId !== undefined ? { currentOrderId: dto.currentOrderId } : {}),
      },
    });
  }

  async deleteTable(id: string) {
    await this.require(this.prisma.mesaVenta.findUnique({ where: { id } }), 'Mesa');
    return this.prisma.mesaVenta.delete({ where: { id } });
  }

  listTeamAccounts() {
    return this.prisma.cuentaEquipo.findMany({ orderBy: { openedAt: 'desc' } });
  }

  createTeamAccount(dto: CreateTeamAccountDto) {
    return this.prisma.cuentaEquipo.create({
      data: {
        team: dto.team,
        status: (dto.status as EstadoCuentaEquipo) ?? 'abierta',
        items: (dto.items ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  async updateTeamAccount(id: string, dto: UpdateTeamAccountDto) {
    await this.require(this.prisma.cuentaEquipo.findUnique({ where: { id } }), 'Cuenta');
    return this.prisma.cuentaEquipo.update({
      where: { id },
      data: {
        ...(dto.team !== undefined ? { team: dto.team } : {}),
        ...(dto.status !== undefined ? { status: dto.status as EstadoCuentaEquipo } : {}),
        ...(dto.items !== undefined ? { items: dto.items as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async deleteTeamAccount(id: string) {
    await this.require(this.prisma.cuentaEquipo.findUnique({ where: { id } }), 'Cuenta');
    return this.prisma.cuentaEquipo.delete({ where: { id } });
  }

  listAudit(limit = 200) {
    return this.prisma.entradaAuditoria.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  createAudit(dto: CreateAuditDto, userId?: string) {
    return this.prisma.entradaAuditoria.create({
      data: {
        module: dto.module,
        action: dto.action,
        element: dto.element,
        previousValue: dto.previousValue,
        newValue: dto.newValue,
        userName: dto.userName,
        userId: userId || undefined,
      },
    });
  }

  private async require<T>(finder: Promise<T | null>, label: string): Promise<T> {
    const row = await finder;
    if (!row) throw new NotFoundException(`${label} no encontrada`);
    return row;
  }
}
