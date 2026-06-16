import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockMovementsService } from './stock-movements.service';

@Module({
  imports: [AuthModule],
  providers: [StockService, StockMovementsService, PrismaService],
  controllers: [StockController],
  exports: [StockService, StockMovementsService],
})
export class StockModule {}
