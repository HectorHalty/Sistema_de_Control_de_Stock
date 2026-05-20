import { Controller, Get, Query, Sse } from '@nestjs/common';
import { Request, Response } from 'express';
import { SseService } from './sse.service';

@Controller('sse')
export class SseController {
  constructor(private sseService: SseService) {}

  @Get('events')
  streamEvents(@Query('kitchenId') kitchenId: string, req: Request, res: Response) {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sseService.addClient(clientId, res, kitchenId);
  }
}
