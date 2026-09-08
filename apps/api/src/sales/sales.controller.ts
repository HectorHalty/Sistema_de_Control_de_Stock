import {

  Controller, Get, Post, Put, Delete, Param, Body, Query,

  UseGuards,

} from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { RolesGuard } from '../common/guards/roles.guard';

import { Roles } from '../common/decorators/roles.decorator';

import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';

import { SalesService } from './sales.service';

import { CheckoutDto, ReturnDto, ReturnItemsDto, UpdateTicketItemsDto, CreateSalesProductDto, UpdateSalesProductDto, CreateKitchenDto, UpdateKitchenDto } from './dto';

import {

  isVendedorRole,

  SALES_ADMIN_ROLES,

  SALES_CATALOG_ROLES,

  SALES_OPERATION_ROLES,

  SALES_READ_ROLES,

} from '../common/roles';



@Controller('sales')

@UseGuards(JwtAuthGuard, RolesGuard)

export class SalesController {

  constructor(private salesService: SalesService) {}



  @Get('products')

  @Roles(...SALES_READ_ROLES)

  findAllProducts() {

    return this.salesService.findAllSalesProducts();

  }



  @Get('products/:id')

  @Roles(...SALES_READ_ROLES)

  findProduct(@Param('id') id: string) {

    return this.salesService.findSalesProductById(id);

  }



  @Post('products')

  @Roles(...SALES_CATALOG_ROLES)

  createProduct(@Body() body: CreateSalesProductDto) {

    return this.salesService.createSalesProduct(body);

  }



  @Put('products/:id')

  @Roles(...SALES_CATALOG_ROLES)

  updateProduct(@Param('id') id: string, @Body() body: UpdateSalesProductDto) {

    return this.salesService.updateSalesProduct(id, body);

  }



  @Post('checkout')

  @Roles(...SALES_OPERATION_ROLES)

  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: AuthUser) {

    return this.salesService.checkout({ ...dto, operatorId: user.id });

  }



  @Post('return')

  @Roles(...SALES_OPERATION_ROLES)

  returnSale(@Body() dto: ReturnDto, @CurrentUser() user: AuthUser) {

    return this.salesService.returnSale({ ...dto, operatorId: user.id });

  }



  @Post('return-items')

  @Roles(...SALES_OPERATION_ROLES)

  returnItems(@Body() dto: ReturnItemsDto, @CurrentUser() user: AuthUser) {

    return this.salesService.returnItems({ ...dto, operatorId: user.id });

  }



  @Get('tickets')

  @Roles(...SALES_READ_ROLES)

  findAllTickets(
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {

    const operatorId = isVendedorRole(user.role) ? user.id : undefined;

    return this.salesService.findAllTickets(status, operatorId, cursor, limit ? Number(limit) : undefined);

  }



  @Get('tickets/:id')

  @Roles(...SALES_READ_ROLES)

  findTicket(@Param('id') id: string, @CurrentUser() user: AuthUser) {

    const operatorId = isVendedorRole(user.role) ? user.id : undefined;

    return this.salesService.findTicketById(id, operatorId);

  }



  @Post('tickets/:id/void')

  @Roles(...SALES_ADMIN_ROLES)

  voidTicket(@Param('id') id: string, @CurrentUser() user: AuthUser) {

    return this.salesService.voidTicket(id, user.id);

  }



  @Put('tickets/:id/items')

  @Roles(...SALES_ADMIN_ROLES)

  updateTicketItems(

    @Param('id') id: string,

    @Body() dto: UpdateTicketItemsDto,

    @CurrentUser() user: AuthUser,

  ) {

    return this.salesService.updateTicketItems(id, { ...dto, operatorId: user.id });

  }



  @Get('kitchens')

  @Roles(...SALES_READ_ROLES)

  findAllKitchens() {

    return this.salesService.findAllKitchens();

  }



  @Post('kitchens')

  @Roles(...SALES_CATALOG_ROLES)

  createKitchen(@Body() body: CreateKitchenDto) {

    return this.salesService.createKitchen(body);

  }



  @Put('kitchens/:id')

  @Roles(...SALES_CATALOG_ROLES)

  updateKitchen(@Param('id') id: string, @Body() body: UpdateKitchenDto) {

    return this.salesService.updateKitchen(id, body);

  }



  @Delete('kitchens/:id')

  @Roles(...SALES_CATALOG_ROLES)

  removeKitchen(@Param('id') id: string) {

    return this.salesService.deleteKitchen(id);

  }

}


