import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { OnlineCatalogService } from './online-catalog.service';
import { OnlineCatalogController } from './online-catalog.controller';

@Module({
  imports: [AuthModule],
  providers: [OnlineCatalogService, PrismaService],
  controllers: [OnlineCatalogController],
  exports: [OnlineCatalogService],
})
export class OnlineCatalogModule {}
