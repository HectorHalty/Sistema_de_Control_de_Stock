import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SalesService } from './sales.service';
import { CheckoutDto, ReturnDto } from './dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private salesService: SalesService) {}

  // Sales products (menu) - GET for all authenticated
  @Get('products')
  findAllProducts() {
    return this.salesService.findAllSalesProducts();
  }

  @Get('products/:id')
  findProduct(@Param('id') id: string) {
    return this.salesService.findSalesProductById(id);
  }

  // Mutating endpoints require Admin/SuperAdmin
  @Post('products')
  @Roles('Admin', 'SuperAdmin')
  createProduct(@Body() body: {
    name: string; category: string; kitchenId: string; price: number;
    emoji?: string; recipe: { stockProductId: string; quantity: number }[];
  }) {
    return this.salesService.createSalesProduct(body);
  }

  @Put('products/:id')
  @Roles('Admin', 'SuperAdmin')
  updateProduct(@Param('id') id: string, @Body() body: {
    name?: string; category?: string; kitchenId?: string;
    price?: number; emoji?: string; active?: boolean;
    recipe?: { stockProductId: string; quantity: number }[];
  }) {
    return this.salesService.updateSalesProduct(id, body);
  }

  // Checkout/Return - accessible to all authenticated operators
  @Post('checkout')
  checkout(@Body() dto: CheckoutDto) {
    return this.salesService.checkout(dto);
  }

  @Post('return')
  returnSale(@Body() dto: ReturnDto) {
    return this.salesService.returnSale(dto);
  }

  // Tickets
  @Get('tickets')
  findAllTickets(@Query('status') status?: string) {
    return this.salesService.findAllTickets(status);
  }

  @Get('tickets/:id')
  findTicket(@Param('id') id: string) {
    return this.salesService.findTicketById(id);
  }

  @Post('tickets/:id/void')
  @Roles('Admin', 'SuperAdmin')
  voidTicket(@Param('id') id: string, @Body() body: { operatorId: string }) {
    return this.salesService.voidTicket(id, body.operatorId);
  }

  // Kitchens
  @Get('kitchens')
  findAllKitchens() {
    return this.salesService.findAllKitchens();
  }

  @Post('kitchens')
  @Roles('Admin', 'SuperAdmin')
  createKitchen(@Body() body: { name: string; emoji?: string }) {
    return this.salesService.createKitchen(body);
  }

  @Put('kitchens/:id')
  @Roles('Admin', 'SuperAdmin')
  updateKitchen(@Param('id') id: string, @Body() body: { name?: string; emoji?: string; active?: boolean }) {
    return this.salesService.updateKitchen(id, body);
  }

  @Delete('kitchens/:id')
  @Roles('Admin', 'SuperAdmin')
  removeKitchen(@Param('id') id: string) {
    return this.salesService.deleteKitchen(id);
  }
}
