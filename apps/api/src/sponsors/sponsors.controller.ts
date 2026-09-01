import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SponsorsService } from './sponsors.service';
import { FOOTBALL_MUTATION_ROLES, FOOTBALL_READ_ROLES, ONLINE_MUTATION_ROLES, ONLINE_READ_ROLES } from '../common/roles';

const SPONSOR_READ_ROLES = [...new Set([...FOOTBALL_READ_ROLES, ...ONLINE_READ_ROLES])];
const SPONSOR_MUTATION_ROLES = [...new Set([...FOOTBALL_MUTATION_ROLES, ...ONLINE_MUTATION_ROLES])];

@Controller('sponsors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SponsorsController {
  constructor(private sponsorsService: SponsorsService) {}

  @Get()
  @Roles(...SPONSOR_READ_ROLES)
  findAll(@Query('active') active?: string, @Query('placement') placement?: string) {
    return this.sponsorsService.findAll(
      active !== undefined ? active === 'true' : undefined,
      placement,
    );
  }

  @Get(':id')
  @Roles(...SPONSOR_READ_ROLES)
  findOne(@Param('id') id: string) {
    return this.sponsorsService.findById(id);
  }

  @Post()
  @Roles(...SPONSOR_MUTATION_ROLES)
  create(
    @Body()
    body: {
      name: string;
      imageUrl: string;
      placement?: string;
      linkUrl?: string;
      bannerLabel?: string;
      mediaType?: string;
      widthPx?: number;
      heightPx?: number;
      sortOrder?: number;
    },
  ) {
    return this.sponsorsService.create(body);
  }

  @Put(':id')
  @Roles(...SPONSOR_MUTATION_ROLES)
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      imageUrl?: string;
      placement?: string;
      active?: boolean;
      linkUrl?: string;
      bannerLabel?: string;
      mediaType?: string;
      widthPx?: number;
      heightPx?: number;
      sortOrder?: number;
    },
  ) {
    return this.sponsorsService.update(id, body);
  }

  @Delete(':id')
  @Roles(...SPONSOR_MUTATION_ROLES)
  remove(@Param('id') id: string) {
    return this.sponsorsService.delete(id);
  }
}
