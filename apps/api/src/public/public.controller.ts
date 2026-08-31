import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private publicService: PublicService) {}

  @Get('home-bundle')
  getHomeBundle() {
    return this.publicService.getHomeBundle();
  }

  @Get('torneo')
  getTorneo(@Query('id') id?: string) {
    return this.publicService.getTorneoDetail(id);
  }

  @Get('reglamento')
  getReglamento() {
    return this.publicService.listReglamento();
  }

  @Get('menu')
  getMenu() {
    return this.publicService.listMenu();
  }

  @Get('sponsors')
  getSponsors() {
    return this.publicService.listSponsors();
  }

  @Get('media')
  getMedia(@Query('type') type?: string) {
    return this.publicService.listMedia(type);
  }
}
