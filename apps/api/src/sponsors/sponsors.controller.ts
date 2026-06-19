import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SponsorsService } from './sponsors.service';
import { FOOTBALL_MUTATION_ROLES, FOOTBALL_READ_ROLES } from '../common/roles';

@Controller('sponsors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SponsorsController {
  constructor(private sponsorsService: SponsorsService) {}

  @Get()
  @Roles(...FOOTBALL_READ_ROLES)
  findAll(@Query('active') active?: string, @Query('placement') placement?: string) {
    return this.sponsorsService.findAll(
      active !== undefined ? active === 'true' : undefined,
      placement,
    );
  }

  @Get(':id')
  @Roles(...FOOTBALL_READ_ROLES)
  findOne(@Param('id') id: string) {
    return this.sponsorsService.findById(id);
  }

  @Post()
  @Roles(...FOOTBALL_MUTATION_ROLES)
  create(@Body() body: { name: string; imageUrl: string; placement?: string; linkUrl?: string }) {
    return this.sponsorsService.create(body);
  }

  @Put(':id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  update(@Param('id') id: string, @Body() body: { name?: string; imageUrl?: string; placement?: string; active?: boolean; linkUrl?: string }) {
    return this.sponsorsService.update(id, body);
  }

  @Delete(':id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  remove(@Param('id') id: string) {
    return this.sponsorsService.delete(id);
  }
}
