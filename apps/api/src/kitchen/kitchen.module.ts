import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { SseService } from '../sse/sse.service';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';

@Module({
  imports: [AuthModule],
  providers: [KitchenService, PrismaService, SseService],
  controllers: [KitchenController],
  exports: [KitchenService, SseService],
})
export class KitchenModule {}
