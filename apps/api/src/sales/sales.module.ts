import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

@Module({
  imports: [AuthModule],
  providers: [SalesService, PrismaService],
  controllers: [SalesController],
  exports: [SalesService],
})
export class SalesModule {}
