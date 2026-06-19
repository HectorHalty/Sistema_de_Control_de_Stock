import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { KitchenService } from './kitchen.service';
import { TransitionDto } from './dto';
import { KITCHEN_MUTATION_ROLES, KITCHEN_READ_ROLES } from '../common/roles';

@Controller('kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KitchenController {
  constructor(private kitchenService: KitchenService) {}

  @Get('orders')
  @Roles(...KITCHEN_READ_ROLES)
  findAllOrders(@Query('kitchenId') kitchenId?: string, @Query('status') status?: string) {
    return this.kitchenService.findAllOrders(kitchenId, status);
  }

  @Get('orders/:id')
  @Roles(...KITCHEN_READ_ROLES)
  findOrder(@Param('id') id: string) {
    return this.kitchenService.findOrderById(id);
  }

  @Get('kitchens/:kitchenId/active-orders')
  @Roles(...KITCHEN_READ_ROLES)
  activeOrders(@Param('kitchenId') kitchenId: string) {
    return this.kitchenService.getActiveOrdersForKitchen(kitchenId);
  }

  @Post('orders/:id/transition')
  @Roles(...KITCHEN_MUTATION_ROLES)
  transition(@Param('id') id: string, @Body() dto: TransitionDto) {
    return this.kitchenService.transitionOrder(id, dto.status);
  }
}
