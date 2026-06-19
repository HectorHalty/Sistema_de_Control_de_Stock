import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { StockService } from './stock.service';
import { CreateProductDto, UpdateProductDto, AdjustStockDto, CreateEmployeeConsumptionDto, CreateStockCountSessionDto, CreateSupplierDto, UpdateSupplierDto, CreatePurchaseOrderDto, ReceivePurchaseOrderDto } from './dto';
import {
  STOCK_COUNT_ROLES,
  STOCK_CONSUMPTION_ROLES,
  STOCK_MUTATION_ROLES,
  STOCK_READ_ROLES,
} from '../common/roles';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private stockService: StockService) {}

  @Get('products')
  @Roles(...STOCK_READ_ROLES)
  findAll(@Query('categoryId') categoryId?: string) {
    return this.stockService.findAllProducts(categoryId);
  }

  @Get('products/:id')
  @Roles(...STOCK_READ_ROLES)
  findOne(@Param('id') id: string) {
    return this.stockService.findProductById(id);
  }

  @Post('products')
  @Roles(...STOCK_MUTATION_ROLES)
  create(@Body() dto: CreateProductDto) {
    return this.stockService.createProduct(dto);
  }

  @Put('products/:id')
  @Roles(...STOCK_MUTATION_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.stockService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @Roles(...STOCK_MUTATION_ROLES)
  remove(@Param('id') id: string) {
    return this.stockService.deleteProduct(id);
  }

  @Get('products/:id/stock')
  @Roles(...STOCK_READ_ROLES)
  getStockLevels(@Param('id') id: string) {
    return this.stockService.getStockLevels(id);
  }

  @Post('products/:id/stock/adjust')
  @Roles(...STOCK_MUTATION_ROLES)
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.stockService.adjustStock(id, dto);
  }

  @Get('warehouses')
  @Roles(...STOCK_READ_ROLES)
  findAllWarehouses() {
    return this.stockService.findAllWarehouses();
  }

  @Post('warehouses')
  @Roles(...STOCK_MUTATION_ROLES)
  createWarehouse(@Body() dto: { name: string; location: string; icon?: string }) {
    return this.stockService.createWarehouse(dto);
  }

  @Put('warehouses/:id')
  @Roles(...STOCK_MUTATION_ROLES)
  updateWarehouse(@Param('id') id: string, @Body() dto: { name?: string; location?: string; icon?: string }) {
    return this.stockService.updateWarehouse(id, dto);
  }

  @Delete('warehouses/:id')
  @Roles(...STOCK_MUTATION_ROLES)
  removeWarehouse(@Param('id') id: string) {
    return this.stockService.deleteWarehouse(id);
  }

  @Get('categories')
  @Roles(...STOCK_READ_ROLES)
  findAllCategories() {
    return this.stockService.findAllCategories();
  }

  @Post('categories')
  @Roles(...STOCK_MUTATION_ROLES)
  createCategory(@Body() dto: { name: string; icon?: string }) {
    return this.stockService.createCategory(dto);
  }

  @Put('categories/:id')
  @Roles(...STOCK_MUTATION_ROLES)
  updateCategory(@Param('id') id: string, @Body() dto: { name?: string; icon?: string }) {
    return this.stockService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles(...STOCK_MUTATION_ROLES)
  removeCategory(@Param('id') id: string) {
    return this.stockService.deleteCategory(id);
  }

  @Get('movements')
  @Roles(...STOCK_READ_ROLES)
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

  @Get('employee-consumptions')
  @Roles(...STOCK_READ_ROLES)
  findAllEmployeeConsumptions(@Query('limit') limit?: string) {
    return this.stockService.findAllEmployeeConsumptions(
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('employee-consumptions')
  @Roles(...STOCK_CONSUMPTION_ROLES)
  createEmployeeConsumption(@Body() dto: CreateEmployeeConsumptionDto) {
    return this.stockService.createEmployeeConsumption(dto);
  }

  @Get('count-sessions')
  @Roles(...STOCK_READ_ROLES)
  findAllCountSessions(@Query('limit') limit?: string) {
    return this.stockService.findAllStockCountSessions(
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('count-sessions')
  @Roles(...STOCK_COUNT_ROLES)
  createCountSession(@Body() dto: CreateStockCountSessionDto) {
    return this.stockService.createStockCountSession(dto);
  }

  @Get('suppliers')
  @Roles(...STOCK_READ_ROLES)
  findAllSuppliers() {
    return this.stockService.findAllSuppliers();
  }

  @Post('suppliers')
  @Roles(...STOCK_MUTATION_ROLES)
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.stockService.createSupplier(dto);
  }

  @Put('suppliers/:id')
  @Roles(...STOCK_MUTATION_ROLES)
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.stockService.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id')
  @Roles(...STOCK_MUTATION_ROLES)
  removeSupplier(@Param('id') id: string) {
    return this.stockService.deleteSupplier(id);
  }

  @Get('purchase-orders')
  @Roles(...STOCK_READ_ROLES)
  findAllPurchaseOrders(@Query('status') status?: string) {
    return this.stockService.findAllPurchaseOrders(status);
  }

  @Get('purchase-orders/:id')
  @Roles(...STOCK_READ_ROLES)
  findPurchaseOrder(@Param('id') id: string) {
    return this.stockService.findPurchaseOrderById(id);
  }

  @Post('purchase-orders')
  @Roles(...STOCK_MUTATION_ROLES)
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.stockService.createPurchaseOrder(dto);
  }

  @Post('purchase-orders/:id/receive')
  @Roles(...STOCK_MUTATION_ROLES)
  receivePurchaseOrder(@Param('id') id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.stockService.receivePurchaseOrder(id, dto);
  }
}
