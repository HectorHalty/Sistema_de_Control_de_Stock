import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Don't crash the whole API if the database is unreachable. Endpoints that
    // don't touch the DB (e.g. /health, /printing) keep working; DB-backed
    // calls will fail individually until the connection is available.
    try {
      await this.$connect();
    } catch (err) {
      this.logger.warn(
        `No se pudo conectar a la base de datos al iniciar: ${
          err instanceof Error ? err.message : String(err)
        }. La API arranca igual (los endpoints sin base seguirán funcionando).`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
