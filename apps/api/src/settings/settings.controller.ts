import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { ADMIN_ROLES, SALES_CATALOG_ROLES } from '../common/roles';
import { SettingsService } from './settings.service';
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

const SETTINGS_ROLES = [...ADMIN_ROLES, ...SALES_CATALOG_ROLES] as const;

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get('config')
  @Roles(...SETTINGS_ROLES)
  listConfig(@Query('scope') scope?: string) {
    return this.settings.listConfig(scope);
  }

  @Put('config')
  @Roles(...SETTINGS_ROLES)
  upsertConfig(@Body() dto: UpsertConfigDto) {
    return this.settings.upsertConfig(dto);
  }

  @Get('sales-categories')
  @Roles(...SETTINGS_ROLES)
  listSalesCategories() {
    return this.settings.listSalesCategories();
  }

  @Post('sales-categories')
  @Roles(...SETTINGS_ROLES)
  createSalesCategory(@Body() dto: CreateSalesCategoryDto) {
    return this.settings.createSalesCategory(dto);
  }

  @Put('sales-categories/:id')
  @Roles(...SETTINGS_ROLES)
  updateSalesCategory(@Param('id') id: string, @Body() dto: UpdateSalesCategoryDto) {
    return this.settings.updateSalesCategory(id, dto);
  }

  @Delete('sales-categories/:id')
  @Roles(...SETTINGS_ROLES)
  deleteSalesCategory(@Param('id') id: string) {
    return this.settings.deleteSalesCategory(id);
  }

  @Get('printers')
  @Roles(...SETTINGS_ROLES)
  listPrinters() {
    return this.settings.listPrinters();
  }

  @Post('printers')
  @Roles(...SETTINGS_ROLES)
  createPrinter(@Body() dto: CreatePrinterDto) {
    return this.settings.createPrinter(dto);
  }

  @Put('printers/:id')
  @Roles(...SETTINGS_ROLES)
  updatePrinter(@Param('id') id: string, @Body() dto: UpdatePrinterDto) {
    return this.settings.updatePrinter(id, dto);
  }

  @Delete('printers/:id')
  @Roles(...SETTINGS_ROLES)
  deletePrinter(@Param('id') id: string) {
    return this.settings.deletePrinter(id);
  }

  @Get('tables')
  @Roles(...SETTINGS_ROLES)
  listTables() {
    return this.settings.listTables();
  }

  @Post('tables')
  @Roles(...SETTINGS_ROLES)
  createTable(@Body() dto: CreateTableDto) {
    return this.settings.createTable(dto);
  }

  @Put('tables/:id')
  @Roles(...SETTINGS_ROLES)
  updateTable(@Param('id') id: string, @Body() dto: UpdateTableDto) {
    return this.settings.updateTable(id, dto);
  }

  @Delete('tables/:id')
  @Roles(...SETTINGS_ROLES)
  deleteTable(@Param('id') id: string) {
    return this.settings.deleteTable(id);
  }

  @Get('team-accounts')
  @Roles(...SETTINGS_ROLES)
  listTeamAccounts() {
    return this.settings.listTeamAccounts();
  }

  @Post('team-accounts')
  @Roles(...SETTINGS_ROLES)
  createTeamAccount(@Body() dto: CreateTeamAccountDto) {
    return this.settings.createTeamAccount(dto);
  }

  @Put('team-accounts/:id')
  @Roles(...SETTINGS_ROLES)
  updateTeamAccount(@Param('id') id: string, @Body() dto: UpdateTeamAccountDto) {
    return this.settings.updateTeamAccount(id, dto);
  }

  @Delete('team-accounts/:id')
  @Roles(...SETTINGS_ROLES)
  deleteTeamAccount(@Param('id') id: string) {
    return this.settings.deleteTeamAccount(id);
  }

  @Get('audit')
  @Roles(...SETTINGS_ROLES)
  listAudit(@Query('limit') limit?: string) {
    return this.settings.listAudit(limit ? parseInt(limit, 10) : 200);
  }

  @Post('audit')
  @Roles(...SETTINGS_ROLES)
  createAudit(@Body() dto: CreateAuditDto, @CurrentUser() user: AuthUser) {
    return this.settings.createAudit(dto, user.id);
  }
}
