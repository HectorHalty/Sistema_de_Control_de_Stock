import { Controller, Post, Body } from '@nestjs/common';
import { PrintingService } from './printing.service';
import { PrintTicketDto, TestPrinterDto } from './dto';

/**
 * Network printing endpoints. Public (no auth) and consistent with /health,
 * since the frontend calls them without a token. The API process must run on a
 * machine in the same LAN as the thermal printer.
 */
@Controller('printing')
export class PrintingController {
  constructor(private readonly printingService: PrintingService) {}

  @Post('test')
  test(@Body() dto: TestPrinterDto) {
    return this.printingService.testConnection(dto);
  }

  @Post('print')
  print(@Body() dto: PrintTicketDto) {
    return this.printingService.printTicket(dto);
  }
}
