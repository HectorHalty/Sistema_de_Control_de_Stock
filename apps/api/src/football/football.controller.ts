import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FootballService } from './football.service';

@Controller('football')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FootballController {
  constructor(private footballService: FootballService) {}

  // GET for all authenticated
  @Get('teams')
  findAllTeams() {
    return this.footballService.findAllTeams();
  }

  @Get('matches')
  findAllMatches(@Query('status') status?: string) {
    return this.footballService.findAllMatches(status);
  }

  @Get('standings')
  getStandings() {
    return this.footballService.getStandings();
  }

  // Mutating endpoints require Admin/SuperAdmin
  @Post('teams')
  @Roles('Admin', 'SuperAdmin')
  createTeam(@Body() body: { name: string; shortName?: string; logo?: string }) {
    return this.footballService.createTeam(body);
  }

  @Post('matches')
  @Roles('Admin', 'SuperAdmin')
  createMatch(@Body() body: { homeTeamId: string; awayTeamId: string; date: string; venue?: string }) {
    return this.footballService.createMatch(body);
  }

  @Put('matches/:id/score')
  @Roles('Admin', 'SuperAdmin')
  updateScore(@Param('id') id: string, @Body() body: { homeGoals: number; awayGoals: number }) {
    return this.footballService.updateMatchScore(id, body.homeGoals, body.awayGoals);
  }
}
