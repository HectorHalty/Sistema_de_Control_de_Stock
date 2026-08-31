import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { OnlineService } from './online.service';
import { ONLINE_MUTATION_ROLES, ONLINE_READ_ROLES } from '../common/roles';

@Controller('online')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnlineController {
  constructor(private online: OnlineService) {}

  @Get('overview')
  @Roles(...ONLINE_READ_ROLES)
  getOverview() {
    return this.online.getOverview();
  }

  @Get('metrics')
  @Roles(...ONLINE_READ_ROLES)
  getMetrics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.online.getMetrics(from, to);
  }

  @Get('orders')
  @Roles(...ONLINE_READ_ROLES)
  listOrders(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.online.listOrders(status, limit ? Number(limit) : 50);
  }

  @Get('menu')
  @Roles(...ONLINE_READ_ROLES)
  listMenu(@Query('visibleOnly') visibleOnly?: string) {
    return this.online.listWebMenu(visibleOnly === 'true');
  }

  @Put('menu/:id')
  @Roles(...ONLINE_MUTATION_ROLES)
  updateMenu(
    @Param('id') id: string,
    @Body()
    body: {
      visibleWeb?: boolean;
      descripcionWeb?: string | null;
      imagenWeb?: string | null;
      emoji?: string | null;
      price?: number;
    },
  ) {
    return this.online.updateWebMenu(id, body);
  }

  @Post('redeem-qr')
  @Roles(...ONLINE_MUTATION_ROLES)
  redeemQr(@Body() body: { token: string }, @CurrentUser() user: AuthUser) {
    return this.online.redeemQr(body.token, user.id);
  }
}
