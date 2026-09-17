import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { KITCHEN_READ_ROLES } from '../common/roles';
import { SseService } from './sse.service';

@Controller('sse')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SseController {
  constructor(private sseService: SseService) {}

  @Get('events')
  @Roles(...KITCHEN_READ_ROLES)
  streamEvents(@Query('kitchenId') kitchenId: string, @Res() res: Response) {
    // `@Res()` (sin passthrough) es imprescindible acá: sin decorar el parámetro,
    // Nest nunca inyecta el Response de Express y `sseService.addClient` explota
    // al llamar `res.writeHead` sobre `undefined` — el endpoint quedaba roto para
    // cualquier cliente (no sólo para el adapter de React que no lo consumía).
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sseService.addClient(clientId, res, kitchenId);
  }
}
