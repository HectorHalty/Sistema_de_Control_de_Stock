import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OnlineCatalogService } from './online-catalog.service';
import { ONLINE_MUTATION_ROLES, ONLINE_READ_ROLES } from '../common/roles';

@Controller('online-catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnlineCatalogController {
  constructor(private catalogService: OnlineCatalogService) {}

  @Get('products')
  @Roles(...ONLINE_READ_ROLES)
  findAll(@Query('active') active?: string, @Query('category') category?: string) {
    return this.catalogService.findAll(
      active !== undefined ? active === 'true' : undefined,
      category,
    );
  }

  @Get('products/:id')
  @Roles(...ONLINE_READ_ROLES)
  findOne(@Param('id') id: string) {
    return this.catalogService.findById(id);
  }

  @Post('products')
  @Roles(...ONLINE_MUTATION_ROLES)
  create(@Body() body: {
    name: string; description?: string; price: number; image?: string;
    images?: string[]; category: string; attributes?: Record<string, any>;
    stockProductId?: string;
  }) {
    return this.catalogService.create(body);
  }

  @Put('products/:id')
  @Roles(...ONLINE_MUTATION_ROLES)
  update(@Param('id') id: string, @Body() body: {
    name?: string; description?: string; price?: number; image?: string;
    images?: string[]; category?: string; attributes?: Record<string, any>;
    active?: boolean; stockProductId?: string;
  }) {
    return this.catalogService.update(id, body);
  }

  @Delete('products/:id')
  @Roles(...ONLINE_MUTATION_ROLES)
  remove(@Param('id') id: string) {
    return this.catalogService.delete(id);
  }
}
