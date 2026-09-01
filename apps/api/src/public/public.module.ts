import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';
import { SseModule } from '../sse/sse.module';
import { ReglamentoModule } from '../reglamento/reglamento.module';
import { FootballModule } from '../football/football.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { PublicAuthService } from './public-auth.service';
import { PublicMeService, PublicCaptainService } from './public-me.service';
import { PublicAuthController } from './public-auth.controller';
import { PublicMeController } from './public-me.controller';
import { PublicCaptainController } from './public-captain.controller';
import { PublicOrdersController } from './public-orders.controller';
import { PublicOrdersService } from './public-orders.service';
import { PublicJwtStrategy } from './public-jwt.strategy';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { PublicCaptainGuard } from './guards/public-captain.guard';

@Module({
  imports: [ReglamentoModule, FootballModule, AuthModule, PassportModule, SalesModule, SseModule],
  controllers: [
    PublicController,
    PublicAuthController,
    PublicMeController,
    PublicCaptainController,
    PublicOrdersController,
  ],
  providers: [
    PublicService,
    PublicAuthService,
    PublicMeService,
    PublicCaptainService,
    PublicOrdersService,
    PublicJwtStrategy,
    PublicAuthGuard,
    PublicCaptainGuard,
  ],
})
export class PublicModule {}