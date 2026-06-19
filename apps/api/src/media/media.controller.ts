import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MediaService } from './media.service';
import { CreatePresignDto, CreateMediaDto } from './dto';
import { FOOTBALL_MUTATION_ROLES, FOOTBALL_READ_ROLES } from '../common/roles';

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Get()
  @Roles(...FOOTBALL_READ_ROLES)
  findAll(@Query('type') type?: string, @Query('matchDate') matchDate?: string) {
    return this.mediaService.findAll(type, matchDate);
  }

  @Get(':id')
  @Roles(...FOOTBALL_READ_ROLES)
  findOne(@Param('id') id: string) {
    return this.mediaService.findById(id);
  }

  @Post('presign')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  createPresignedUpload(@Body() dto: CreatePresignDto) {
    return this.mediaService.createPresignedUpload(dto);
  }

  @Post('confirm')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  confirmUpload(@Body() body: { key: string } & CreateMediaDto) {
    const { key, ...dto } = body;
    return this.mediaService.confirmUpload(key, dto);
  }

  @Delete(':id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  remove(@Param('id') id: string) {
    return this.mediaService.delete(id);
  }
}
