import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [SseService],
  controllers: [SseController],
  exports: [SseService],
})
export class SseModule {}
