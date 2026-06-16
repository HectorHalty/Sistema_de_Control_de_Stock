import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  NotFoundException, ConflictException, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { StockService } from './stock.service';
import { CreateProductDto, UpdateProductDto, AdjustStockDto } from './dto';

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
}
