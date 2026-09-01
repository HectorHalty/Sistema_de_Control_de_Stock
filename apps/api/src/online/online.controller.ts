import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
  getMetrics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('range') range?: '7d' | '30d' | '90d' | 'Año',
  ) {
    return this.online.getMetrics(from, to, range);
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

  @Post('menu')
  @Roles(...ONLINE_MUTATION_ROLES)
  createMenu(
    @Body()
    body: {
      name: string;
      category: string;
      kitchenId: string;
      price: number;
      emoji?: string;
      descripcionWeb?: string;
      imagenWeb?: string;
      visibleWeb?: boolean;
      webCategoryId?: string;
      popularWeb?: boolean;
      filterIds?: string[];
      recipe?: { stockProductId: string; quantity: number }[];
    },
  ) {
    return this.online.createWebMenuProduct(body);
  }

  @Put('menu/:id')
  @Roles(...ONLINE_MUTATION_ROLES)
  updateMenu(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      category?: string;
      kitchenId?: string;
      visibleWeb?: boolean;
      descripcionWeb?: string | null;
      imagenWeb?: string | null;
      emoji?: string | null;
      price?: number;
      webCategoryId?: string | null;
      popularWeb?: boolean;
      webSortOrder?: number;
      filterIds?: string[];
      active?: boolean;
    },
  ) {
    return this.online.updateWebMenu(id, body);
  }

  @Get('categories')
  @Roles(...ONLINE_READ_ROLES)
  listCategories() {
    return this.online.listCategories();
  }

  @Post('categories')
  @Roles(...ONLINE_MUTATION_ROLES)
  createCategory(@Body() body: { name: string; sortOrder?: number }) {
    return this.online.createCategory(body);
  }

  @Put('categories/:id')
  @Roles(...ONLINE_MUTATION_ROLES)
  updateCategory(
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number; active?: boolean },
  ) {
    return this.online.updateCategory(id, body);
  }

  @Delete('categories/:id')
  @Roles(...ONLINE_MUTATION_ROLES)
  deleteCategory(@Param('id') id: string) {
    return this.online.deleteCategory(id);
  }

  @Get('filters')
  @Roles(...ONLINE_READ_ROLES)
  listFilters() {
    return this.online.listFilters();
  }

  @Get('kitchens')
  @Roles(...ONLINE_READ_ROLES)
  listKitchens() {
    return this.online.listKitchens();
  }

  @Post('filters')
  @Roles(...ONLINE_MUTATION_ROLES)
  createFilter(@Body() body: { label: string; slug?: string; sortOrder?: number }) {
    return this.online.createFilter(body);
  }

  @Put('filters/:id')
  @Roles(...ONLINE_MUTATION_ROLES)
  updateFilter(
    @Param('id') id: string,
    @Body() body: { label?: string; slug?: string; sortOrder?: number; active?: boolean },
  ) {
    return this.online.updateFilter(id, body);
  }

  @Delete('filters/:id')
  @Roles(...ONLINE_MUTATION_ROLES)
  deleteFilter(@Param('id') id: string) {
    return this.online.deleteFilter(id);
  }

  @Post('redeem-qr')
  @Roles(...ONLINE_MUTATION_ROLES)
  redeemQr(@Body() body: { token: string }, @CurrentUser() user: AuthUser) {
    return this.online.redeemQr(body.token, user.id);
  }
}
