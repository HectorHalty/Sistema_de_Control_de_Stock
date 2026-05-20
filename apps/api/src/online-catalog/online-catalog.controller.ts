import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OnlineCatalogService } from './online-catalog.service';

@Controller('online-catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnlineCatalogController {
  constructor(private catalogService: OnlineCatalogService) {}

  // GET for all authenticated
  @Get('products')
  findAll(@Query('active') active?: string, @Query('category') category?: string) {
    return this.catalogService.findAll(
      active !== undefined ? active === 'true' : undefined,
      category,
    );
  }

  @Get('products/:id')
  findOne(@Param('id') id: string) {
    return this.catalogService.findById(id);
  }

  // Mutating endpoints require Admin/SuperAdmin
  @Post('products')
  @Roles('Admin', 'SuperAdmin')
  create(@Body() body: {
    name: string; description?: string; price: number; image?: string;
    images?: string[]; category: string; attributes?: Record<string, any>;
    stockProductId?: string;
  }) {
    return this.catalogService.create(body);
  }

  @Put('products/:id')
  @Roles('Admin', 'SuperAdmin')
  update(@Param('id') id: string, @Body() body: {
    name?: string; description?: string; price?: number; image?: string;
    images?: string[]; category?: string; attributes?: Record<string, any>;
    active?: boolean; stockProductId?: string;
  }) {
    return this.catalogService.update(id, body);
  }

  @Delete('products/:id')
  @Roles('Admin', 'SuperAdmin')
  remove(@Param('id') id: string) {
    return this.catalogService.delete(id);
  }
}
