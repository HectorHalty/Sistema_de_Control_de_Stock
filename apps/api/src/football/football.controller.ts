import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FootballService } from './football.service';
import { FOOTBALL_MUTATION_ROLES, FOOTBALL_READ_ROLES } from '../common/roles';

@Controller('football')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FootballController {
  constructor(private footballService: FootballService) {}

  @Get('teams')
  @Roles(...FOOTBALL_READ_ROLES)
  findAllTeams() {
    return this.footballService.findAllTeams();
  }

  @Get('matches')
  @Roles(...FOOTBALL_READ_ROLES)
  findAllMatches(@Query('status') status?: string) {
    return this.footballService.findAllMatches(status);
  }

  @Get('standings')
  @Roles(...FOOTBALL_READ_ROLES)
  getStandings() {
    return this.footballService.getStandings();
  }

  @Post('teams')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  createTeam(@Body() body: { name: string; shortName?: string; logo?: string }) {
    return this.footballService.createTeam(body);
  }

  @Post('matches')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  createMatch(@Body() body: { homeTeamId: string; awayTeamId: string; date: string; venue?: string }) {
    return this.footballService.createMatch(body);
  }

  @Put('matches/:id/score')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  updateScore(@Param('id') id: string, @Body() body: { homeGoals: number; awayGoals: number }) {
    return this.footballService.updateMatchScore(id, body.homeGoals, body.awayGoals);
  }
}
