import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StockModule } from './stock/stock.module';
import { SalesModule } from './sales/sales.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { MediaModule } from './media/media.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { FootballModule } from './football/football.module';
import { OnlineCatalogModule } from './online-catalog/online-catalog.module';
import { SseModule } from './sse/sse.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    AuthModule,
    StockModule,
    SalesModule,
    KitchenModule,
    MediaModule,
    SponsorsModule,
    FootballModule,
    OnlineCatalogModule,
    SseModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
