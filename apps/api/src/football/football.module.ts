import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReglamentoModule } from '../reglamento/reglamento.module';
import { PrismaService } from '../common/prisma.service';
import { FootballService } from './football.service';
import { FootballController } from './football.controller';
import { FixtureGeneratorService } from './fixture-generator.service';
import { MatchSuspensionService } from './match-suspension.service';
import { SuspensionSyncService } from './suspension-sync.service';

@Module({
  imports: [AuthModule, ReglamentoModule],
  providers: [
    FootballService,
    SuspensionSyncService,
    FixtureGeneratorService,
    MatchSuspensionService,
    PrismaService,
  ],
  controllers: [FootballController],
  exports: [FootballService],
})
export class FootballModule {}
