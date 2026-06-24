import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PRINTER_ROLES } from '../common/roles';
import { PrintingService } from './printing.service';
import { PrintTicketDto, RenderTicketDto, TestPrinterDto } from './dto';

@Controller('printing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrintingController {
  constructor(private readonly printingService: PrintingService) {}

  @Post('test')
  @Roles(...PRINTER_ROLES)
  test(@Body() dto: TestPrinterDto) {
    return this.printingService.testConnection(dto);
  }

  @Post('render')
  @Roles(...PRINTER_ROLES)
  render(@Body() dto: RenderTicketDto) {
    return this.printingService.renderTicket(dto);
  }

  @Post('print')
  @Roles(...PRINTER_ROLES)
  print(@Body() dto: PrintTicketDto) {
    return this.printingService.printTicket(dto);
  }
}
