import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MediaService } from './media.service';
import { CreatePresignDto, CreateMediaDto } from './dto';

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private mediaService: MediaService) {}

  // GET for all authenticated
  @Get()
  findAll(@Query('type') type?: string, @Query('matchDate') matchDate?: string) {
    return this.mediaService.findAll(type, matchDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mediaService.findById(id);
  }

  // Mutating endpoints require Admin/SuperAdmin
  @Post('presign')
  @Roles('Admin', 'SuperAdmin')
  createPresignedUpload(@Body() dto: CreatePresignDto) {
    return this.mediaService.createPresignedUpload(dto);
  }

  @Post('confirm')
  @Roles('Admin', 'SuperAdmin')
  confirmUpload(@Body() body: { key: string } & CreateMediaDto) {
    const { key, ...dto } = body;
    return this.mediaService.confirmUpload(key, dto);
  }

  @Delete(':id')
  @Roles('Admin', 'SuperAdmin')
  remove(@Param('id') id: string) {
    return this.mediaService.delete(id);
  }
}
