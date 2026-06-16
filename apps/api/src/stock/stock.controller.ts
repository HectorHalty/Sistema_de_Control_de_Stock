import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  NotFoundException, ConflictException, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { StockService } from './stock.service';
import { CreateProductDto, UpdateProductDto, AdjustStockDto, CreateEmployeeConsumptionDto, CreateStockCountSessionDto, CreateSupplierDto, UpdateSupplierDto, CreatePurchaseOrderDto, ReceivePurchaseOrderDto } from './dto';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private stockService: StockService) {}

  // Products - GET endpoints accessible to all authenticated users
  @Get('products')
  findAll(@Query('categoryId') categoryId?: string) {
    return this.stockService.findAllProducts(categoryId);
  }

  @Get('products/:id')
  findOne(@Param('id') id: string) {
    return this.stockService.findProductById(id);
  }

  // Mutating endpoints require Admin or SuperAdmin
  @Post('products')
  @Roles('Admin', 'SuperAdmin')
  create(@Body() dto: CreateProductDto) {
    return this.stockService.createProduct(dto);
  }

  @Put('products/:id')
  @Roles('Admin', 'SuperAdmin')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.stockService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @Roles('Admin', 'SuperAdmin')
  remove(@Param('id') id: string) {
    return this.stockService.deleteProduct(id);
  }

  // Stock levels
  @Get('products/:id/stock')
  getStockLevels(@Param('id') id: string) {
    return this.stockService.getStockLevels(id);
  }

  @Post('products/:id/stock/adjust')
  @Roles('Admin', 'SuperAdmin')
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.stockService.adjustStock(id, dto);
  }

  // Warehouses
  @Get('warehouses')
  findAllWarehouses() {
    return this.stockService.findAllWarehouses();
  }

  @Post('warehouses')
  @Roles('Admin', 'SuperAdmin')
  createWarehouse(@Body() dto: { name: string; location: string; icon?: string }) {
    return this.stockService.createWarehouse(dto);
  }

  @Put('warehouses/:id')
  @Roles('Admin', 'SuperAdmin')
  updateWarehouse(@Param('id') id: string, @Body() dto: { name?: string; location?: string; icon?: string }) {
    return this.stockService.updateWarehouse(id, dto);
  }

  @Delete('warehouses/:id')
  @Roles('Admin', 'SuperAdmin')
  removeWarehouse(@Param('id') id: string) {
    return this.stockService.deleteWarehouse(id);
  }

  // Categories
  @Get('categories')
  findAllCategories() {
    return this.stockService.findAllCategories();
  }

  @Post('categories')
  @Roles('Admin', 'SuperAdmin')
  createCategory(@Body() dto: { name: string; icon?: string }) {
    return this.stockService.createCategory(dto);
  }

  @Put('categories/:id')
  @Roles('Admin', 'SuperAdmin')
  updateCategory(@Param('id') id: string, @Body() dto: { name?: string; icon?: string }) {
    return this.stockService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles('Admin', 'SuperAdmin')
  removeCategory(@Param('id') id: string) {
    return this.stockService.deleteCategory(id);
  }

  // Stock movements (libro de movimientos)
  @Get('movements')
  findAllMovements(
    @Query('productId') productId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockService.findAllMovements({
      productId,
      type,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // Employee consumption
  @Get('employee-consumptions')
  findAllEmployeeConsumptions(@Query('limit') limit?: string) {
    return this.stockService.findAllEmployeeConsumptions(
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('employee-consumptions')
  createEmployeeConsumption(@Body() dto: CreateEmployeeConsumptionDto) {
    return this.stockService.createEmployeeConsumption(dto);
  }

  // Stock count sessions
  @Get('count-sessions')
  findAllCountSessions(@Query('limit') limit?: string) {
    return this.stockService.findAllStockCountSessions(
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('count-sessions')
  @Roles('Admin', 'SuperAdmin', 'Operador')
  createCountSession(@Body() dto: CreateStockCountSessionDto) {
    return this.stockService.createStockCountSession(dto);
  }

  // Suppliers
  @Get('suppliers')
  findAllSuppliers() {
    return this.stockService.findAllSuppliers();
  }

  @Post('suppliers')
  @Roles('Admin', 'SuperAdmin')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.stockService.createSupplier(dto);
  }

  @Put('suppliers/:id')
  @Roles('Admin', 'SuperAdmin')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.stockService.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id')
  @Roles('Admin', 'SuperAdmin')
  removeSupplier(@Param('id') id: string) {
    return this.stockService.deleteSupplier(id);
  }

  // Purchase orders (pedidos a proveedores)
  @Get('purchase-orders')
  findAllPurchaseOrders(@Query('status') status?: string) {
    return this.stockService.findAllPurchaseOrders(status);
  }

  @Get('purchase-orders/:id')
  findPurchaseOrder(@Param('id') id: string) {
    return this.stockService.findPurchaseOrderById(id);
  }

  @Post('purchase-orders')
  @Roles('Admin', 'SuperAdmin')
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.stockService.createPurchaseOrder(dto);
  }

  @Post('purchase-orders/:id/receive')
  @Roles('Admin', 'SuperAdmin')
  receivePurchaseOrder(@Param('id') id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.stockService.receivePurchaseOrder(id, dto);
  }
}
