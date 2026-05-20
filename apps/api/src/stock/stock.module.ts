import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';

@Module({
  imports: [AuthModule],
  providers: [StockService, PrismaService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
