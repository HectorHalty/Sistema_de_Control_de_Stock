import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrintingService } from './printing.service';
import { PrintingController } from './printing.controller';

@Module({
  imports: [AuthModule],
  providers: [PrintingService],
  controllers: [PrintingController],
  exports: [PrintingService],
})
export class PrintingModule {}
