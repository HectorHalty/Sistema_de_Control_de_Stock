import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { KitchenService } from './kitchen.service';
import { TransitionDto } from './dto';

@Controller('kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KitchenController {
  constructor(private kitchenService: KitchenService) {}

  // GET for all authenticated
  @Get('orders')
  findAllOrders(@Query('kitchenId') kitchenId?: string, @Query('status') status?: string) {
    return this.kitchenService.findAllOrders(kitchenId, status);
  }

  @Get('orders/:id')
  findOrder(@Param('id') id: string) {
    return this.kitchenService.findOrderById(id);
  }

  @Get('kitchens/:kitchenId/active-orders')
  activeOrders(@Param('kitchenId') kitchenId: string) {
    return this.kitchenService.getActiveOrdersForKitchen(kitchenId);
  }

  // Transition requires Admin/SuperAdmin
  @Post('orders/:id/transition')
  @Roles('Admin', 'SuperAdmin')
  transition(@Param('id') id: string, @Body() dto: TransitionDto) {
    return this.kitchenService.transitionOrder(id, dto.status);
  }
}
