import { Body, Controller, Delete, Get, Put, Query, UseGuards } from '@nestjs/common';
import { PublicMeService } from './public-me.service';
import { FollowTeamDto } from './dto/public-auth.dto';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { PublicUser, type PublicAuthUser } from './decorators/public-user.decorator';

@Controller('public')
export class PublicMeController {
  constructor(private me: PublicMeService) {}

  @Get('teams')
  listTeams(@Query('search') search?: string, @Query('torneoId') torneoId?: string) {
    return this.me.listTeams(search, torneoId);
  }

  @Get('me/context')
  @UseGuards(PublicAuthGuard)
  getContext(@PublicUser() user: PublicAuthUser) {
    return this.me.getMeContext(user.id);
  }

  @Put('me/follow-team')
  @UseGuards(PublicAuthGuard)
  followTeam(@PublicUser() user: PublicAuthUser, @Body() dto: FollowTeamDto) {
    return this.me.followTeam(user.id, dto.equipoInscripcionId);
  }

  @Delete('me/follow-team')
  @UseGuards(PublicAuthGuard)
  unfollowTeam(@PublicUser() user: PublicAuthUser) {
    return this.me.unfollowTeam(user.id);
  }
}
