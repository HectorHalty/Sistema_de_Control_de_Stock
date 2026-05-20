import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { SponsorsService } from './sponsors.service';
import { SponsorsController } from './sponsors.controller';

@Module({
  imports: [AuthModule],
  providers: [SponsorsService, PrismaService],
  controllers: [SponsorsController],
  exports: [SponsorsService],
})
export class SponsorsModule {}
