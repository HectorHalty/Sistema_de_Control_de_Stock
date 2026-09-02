import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Header,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FootballService } from './football.service';
import { FOOTBALL_MUTATION_ROLES, FOOTBALL_READ_ROLES } from '../common/roles';

@Controller('football')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FootballController {
  constructor(private footballService: FootballService) {}

  @Get('overview')
  @Roles(...FOOTBALL_READ_ROLES)
  getOverview(@Query('torneoId') torneoId?: string) {
    return this.footballService.getOverview(torneoId);
  }

  @Get('torneos')
  @Roles(...FOOTBALL_READ_ROLES)
  listTorneos() {
    return this.footballService.listTorneos();
  }

  @Put('torneos/:id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  updateTorneo(
    @Param('id') id: string,
    @Body() body: { publicado?: boolean; activo?: boolean; nombre?: string },
  ) {
    return this.footballService.updateTorneo(id, body);
  }

  @Post('torneos')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  createTorneo(
    @Body() body: { campeonatoId: string; categoriaId: string; nombre?: string },
  ) {
    return this.footballService.createTorneo(body);
  }

  @Post('torneos/bootstrap')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  bootstrapTorneos(@Body() body: { campeonatoId?: string }) {
    return this.footballService.bootstrapTorneosCampeonato(body.campeonatoId);
  }

  @Get('scheduling/saturday')
  @Roles(...FOOTBALL_READ_ROLES)
  getSaturdayGrid(@Query('fecha') fecha: string, @Query('campeonatoId') campeonatoId?: string) {
    return this.footballService.getSaturdayGrid(fecha, campeonatoId);
  }

  @Post('scheduling/auto-saturday')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  autoScheduleSaturday(
    @Body() body: { fecha: string; campeonatoId?: string; categoriaOrder?: string[] },
  ) {
    return this.footballService.autoScheduleSaturday(
      body.fecha,
      body.campeonatoId,
      body.categoriaOrder,
    );
  }

  @Post('scheduling/publish-fecha')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  publishJornadasByFecha(@Body() body: { fecha: string; campeonatoId?: string }) {
    return this.footballService.publishJornadasByFecha(body.fecha, body.campeonatoId);
  }

  @Get('categorias')
  @Roles(...FOOTBALL_READ_ROLES)
  listCategorias() {
    return this.footballService.listCategorias();
  }

  @Get('canchas')
  @Roles(...FOOTBALL_READ_ROLES)
  listCanchas() {
    return this.footballService.listCanchas();
  }

  @Get('teams')
  @Roles(...FOOTBALL_READ_ROLES)
  findAllTeams() {
    return this.footballService.findAllTeams();
  }

  @Post('teams')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  createTeam(@Body() body: { name: string; shortName?: string; logo?: string; color?: string }) {
    return this.footballService.createTeam(body);
  }

  @Get('inscriptions')
  @Roles(...FOOTBALL_READ_ROLES)
  listInscriptions(@Query('torneoId') torneoId?: string) {
    return this.footballService.listInscriptions(torneoId);
  }

  @Post('inscriptions')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  createInscription(
    @Body()
    body: {
      torneoId: string;
      equipoId?: string;
      name?: string;
      shortName?: string;
      color?: string;
      abbr?: string;
    },
  ) {
    return this.footballService.createInscription(body);
  }

  @Put('inscriptions/:id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  updateInscription(
    @Param('id') id: string,
    @Body() body: { abbr?: string; color?: string; activo?: boolean; descuentoPuntosWO?: number },
  ) {
    return this.footballService.updateInscription(id, body);
  }

  @Get('captains')
  @Roles(...FOOTBALL_READ_ROLES)
  listCaptains(@Query('torneoId') torneoId?: string) {
    return this.footballService.listCaptains(torneoId);
  }

  @Post('captains')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  createCaptain(
    @Body()
    body: { email: string; dni: string; torneoId: string; equipoInscripcionId: string },
  ) {
    return this.footballService.createCaptain(body);
  }

  @Put('captains/:id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  updateCaptain(
    @Param('id') id: string,
    @Body() body: { email?: string; dni?: string; activo?: boolean },
  ) {
    return this.footballService.updateCaptain(id, body);
  }

  @Delete('captains/:id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  deleteCaptain(@Param('id') id: string) {
    return this.footballService.deleteCaptain(id);
  }

  @Get('roster/:inscripcionId')
  @Roles(...FOOTBALL_READ_ROLES)
  getRoster(@Param('inscripcionId') inscripcionId: string) {
    return this.footballService.getRoster(inscripcionId);
  }

  @Get('roster/:inscripcionId/lista-buena-fe')
  @Roles(...FOOTBALL_READ_ROLES)
  @Header('Content-Type', 'text/html; charset=utf-8')
  getListaBuenaFe(@Param('inscripcionId') inscripcionId: string) {
    return this.footballService.getListaBuenaFeHtml(inscripcionId);
  }

  @Get('jornadas')
  @Roles(...FOOTBALL_READ_ROLES)
  listJornadas(@Query('torneoId') torneoId?: string) {
    return this.footballService.listJornadas(torneoId);
  }

  @Post('jornadas')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  createJornada(@Body() body: { torneoId: string; numero: number; fecha: string }) {
    return this.footballService.createJornada(body);
  }

  @Post('jornadas/:id/round-robin')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  generateRoundRobin(@Param('id') id: string) {
    return this.footballService.generateRoundRobin(id);
  }

  @Post('jornadas/:id/auto-schedule')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  autoScheduleJornada(@Param('id') id: string) {
    return this.footballService.autoScheduleJornada(id);
  }

  @Post('jornadas/:id/suspend-rain')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  suspendJornadaPorLluvia(@Param('id') id: string) {
    return this.footballService.suspendJornadaPorLluvia(id);
  }

  @Post('jornadas/:id/publish')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  publishJornada(@Param('id') id: string) {
    return this.footballService.publishJornada(id);
  }

  @Get('jornadas/:id/preferencias')
  @Roles(...FOOTBALL_READ_ROLES)
  getJornadaPreferencias(@Param('id') id: string) {
    return this.footballService.getJornadaPreferencias(id);
  }

  @Put('jornadas/:id/preferencias/:inscripcionId')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  upsertJornadaPreferencia(
    @Param('id') id: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body() body: { horaPreferida: string | null },
  ) {
    return this.footballService.upsertJornadaPreferencia(
      id,
      inscripcionId,
      body.horaPreferida,
    );
  }

  @Get('matches')
  @Roles(...FOOTBALL_READ_ROLES)
  findAllMatches(
    @Query('status') status?: string,
    @Query('torneoId') torneoId?: string,
    @Query('jornadaId') jornadaId?: string,
  ) {
    return this.footballService.findAllMatches({ status, torneoId, jornadaId });
  }

  @Post('matches')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  createMatch(
    @Body()
    body: {
      homeTeamId: string;
      awayTeamId: string;
      date: string;
      venue?: string;
      torneoId?: string;
      jornadaId?: string;
      homeInscripcionId?: string;
      awayInscripcionId?: string;
      canchaId?: string;
      horaInicio?: string;
    },
  ) {
    return this.footballService.createMatch(body);
  }

  @Put('matches/:id/schedule')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  updateMatchSchedule(
    @Param('id') id: string,
    @Body()
    body: {
      canchaId?: string | null;
      horaInicio?: string | null;
      jornadaId?: string | null;
      bloqueadoManual?: boolean;
      venue?: string | null;
    },
  ) {
    return this.footballService.updateMatchSchedule(id, body);
  }

  @Put('matches/:id/score')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  updateScore(
    @Param('id') id: string,
    @Body()
    body: {
      homeGoals: number;
      awayGoals: number;
      events?: { personaId: string; tipo: string; minuto?: number }[];
    },
  ) {
    return this.footballService.updateMatchScore(id, body.homeGoals, body.awayGoals, body.events);
  }

  @Get('matches/:id/events')
  @Roles(...FOOTBALL_READ_ROLES)
  listMatchEvents(@Param('id') id: string) {
    return this.footballService.listMatchEvents(id);
  }

  @Post('matches/:id/events')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  addMatchEvent(
    @Param('id') id: string,
    @Body() body: { personaId: string; tipo: string; minuto?: number; articuloRef?: string },
  ) {
    return this.footballService.addMatchEvent(id, body);
  }

  @Delete('events/:id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  deleteMatchEvent(@Param('id') id: string) {
    return this.footballService.deleteMatchEvent(id);
  }

  @Get('standings')
  @Roles(...FOOTBALL_READ_ROLES)
  getStandings(@Query('torneoId') torneoId?: string) {
    return this.footballService.getStandings(torneoId);
  }

  @Get('suspensions')
  @Roles(...FOOTBALL_READ_ROLES)
  listSuspensions(@Query('torneoId') torneoId?: string) {
    return this.footballService.listSuspensions(torneoId);
  }

  @Put('suspensions/:id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  updateSuspension(
    @Param('id') id: string,
    @Body() body: { fechasRestantes?: number; activa?: boolean; motivo?: string },
  ) {
    return this.footballService.updateSuspension(id, body);
  }

  @Post('suspensions/sync')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  syncSuspensions(@Query('torneoId') torneoId?: string) {
    return this.footballService.syncSuspensions(torneoId);
  }

  @Get('reglamento')
  @Roles(...FOOTBALL_READ_ROLES)
  listReglamento() {
    return this.footballService.listReglamento();
  }

  @Put('reglamento/articulos/:id')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  updateReglamentoArticulo(
    @Param('id') id: string,
    @Body() body: { titulo?: string; contenido?: string; aplicable?: boolean },
  ) {
    return this.footballService.updateReglamentoArticulo(id, body);
  }
}
