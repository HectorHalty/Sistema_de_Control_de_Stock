import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PublicOrdersService } from './public-orders.service';
import { PublicCheckoutDto } from './dto/public-orders.dto';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { PublicUser, type PublicAuthUser } from './decorators/public-user.decorator';

@Controller('public/orders')
@UseGuards(PublicAuthGuard)
export class PublicOrdersController {
  constructor(private orders: PublicOrdersService) {}

  @Post('checkout')
  checkout(@PublicUser() user: PublicAuthUser, @Body() dto: PublicCheckoutDto) {
    return this.orders.checkout(user.id, dto);
  }

  @Get()
  list(@PublicUser() user: PublicAuthUser) {
    return this.orders.listOrders(user.id);
  }

  @Get(':id')
  getOne(@PublicUser() user: PublicAuthUser, @Param('id') id: string) {
    return this.orders.getOrder(user.id, id);
  }
}
