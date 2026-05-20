import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [AuthModule, ConfigModule],
  providers: [MediaService, PrismaService],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
