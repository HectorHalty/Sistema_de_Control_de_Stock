import { Module } from '@nestjs/common';
import { ReglamentoEngineService } from './reglamento-engine.service';

@Module({
  providers: [ReglamentoEngineService],
  exports: [ReglamentoEngineService],
})
export class ReglamentoModule {}
