import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReglamentoModule } from '../reglamento/reglamento.module';
import { PrismaService } from '../common/prisma.service';
import { FootballService } from './football.service';
import { FootballController } from './football.controller';

@Module({
  imports: [AuthModule, ReglamentoModule],
  providers: [FootballService, PrismaService],
  controllers: [FootballController],
  exports: [FootballService],
})
export class FootballModule {}
