import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness — proceso vivo (Docker healthcheck). */
  @Get()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness — Postgres alcanzable (smoke / load balancer). */
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        db: 'down',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
