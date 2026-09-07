import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StockModule } from './stock/stock.module';
import { SalesModule } from './sales/sales.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { MediaModule } from './media/media.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { FootballModule } from './football/football.module';
import { ReglamentoModule } from './reglamento/reglamento.module';
import { PublicModule } from './public/public.module';
import { OnlineModule } from './online/online.module';
import { SseModule } from './sse/sse.module';
import { PrintingModule } from './printing/printing.module';
import { SettingsModule } from './settings/settings.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StockModule,
    SalesModule,
    KitchenModule,
    MediaModule,
    SponsorsModule,
    FootballModule,
    ReglamentoModule,
    PublicModule,
    OnlineModule,
    SseModule,
    PrintingModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
