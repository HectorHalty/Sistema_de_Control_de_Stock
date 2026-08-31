import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';
import { PrismaService } from '../common/prisma.service';
import { OnlineService } from './online.service';
import { OnlineController } from './online.controller';

@Module({
  imports: [AuthModule, SalesModule],
  providers: [OnlineService, PrismaService],
  controllers: [OnlineController],
  exports: [OnlineService],
})
export class OnlineModule {}
