import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';
import { CheckoutDto, ReturnDto, ReturnItemsDto, UpdateTicketItemsDto } from './dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Get('products')
  findAllProducts() {
    return this.salesService.findAllSalesProducts();
  }

  @Get('products/:id')
  findProduct(@Param('id') id: string) {
    return this.salesService.findSalesProductById(id);
  }

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

  @Post('checkout')
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: AuthUser) {
    return this.salesService.checkout({ ...dto, operatorId: user.id });
  }

  @Post('return')
  returnSale(@Body() dto: ReturnDto, @CurrentUser() user: AuthUser) {
    return this.salesService.returnSale({ ...dto, operatorId: user.id });
  }

  @Post('return-items')
  returnItems(@Body() dto: ReturnItemsDto, @CurrentUser() user: AuthUser) {
    return this.salesService.returnItems({ ...dto, operatorId: user.id });
  }

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
  voidTicket(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.voidTicket(id, user.id);
  }

  @Put('tickets/:id/items')
  @Roles('Admin', 'SuperAdmin')
  updateTicketItems(
    @Param('id') id: string,
    @Body() dto: UpdateTicketItemsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.updateTicketItems(id, { ...dto, operatorId: user.id });
  }

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
