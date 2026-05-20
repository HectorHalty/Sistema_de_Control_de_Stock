import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';

@Module({
  imports: [ConfigModule],
  providers: [SseService],
  controllers: [SseController],
  exports: [SseService],
})
export class SseModule {}
