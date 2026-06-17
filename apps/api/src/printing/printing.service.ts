import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'net';
import { buildTicketBuffer } from './escpos';
import { getLogoRaster } from './logo';
import { PrintTicketDto, TestPrinterDto } from './dto';

const CONNECT_TIMEOUT_MS = 4000;

export interface PrintResult {
  ok: boolean;
  error?: string;
}

@Injectable()
export class PrintingService {
  private readonly logger = new Logger(PrintingService.name);

  /**
   * Opens a raw TCP connection to the printer and verifies reachability.
   * Sends no data — used by the "Probar conexión" button.
   */
  testConnection(dto: TestPrinterDto): Promise<PrintResult> {
    return this.withSocket(dto.ip, dto.port, () => Buffer.alloc(0), true);
  }

  /** Formats the ticket as ESC/POS and streams it to the printer over TCP. */
  async printTicket(dto: PrintTicketDto): Promise<PrintResult> {
    const logoRaster = dto.showLogo ? await getLogoRaster(dto.paperWidth) : null;
    const buffer = buildTicketBuffer({
      paperWidth: dto.paperWidth,
      header: dto.header,
      subheader: dto.subheader,
      footer: dto.footer,
      showDate: dto.showDate,
      showOperator: dto.showOperator,
      showItemDetails: dto.showItemDetails,
      ticketNumber: dto.ticketNumber,
      createdAt: dto.createdAt,
      operatorName: dto.operatorName,
      items: dto.items,
      total: dto.total,
      note: dto.note,
      source: dto.source,
      context: dto.context,
      pickupStation: dto.pickupStation,
      kind: dto.kind,
      logoRaster,
    });
    return this.withSocket(dto.ip, dto.port, () => buffer, false);
  }

  /**
   * Connects to ip:port, optionally writes a payload, and resolves with the
   * outcome. Never throws — connection problems are returned as { ok: false }.
   */
  private withSocket(
    ip: string,
    port: number,
    getPayload: () => Buffer,
    testOnly: boolean,
  ): Promise<PrintResult> {
    return new Promise<PrintResult>((resolve) => {
      const socket = new Socket();
      let settled = false;

      const finish = (result: PrintResult) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(CONNECT_TIMEOUT_MS);

      socket.on('timeout', () => {
        finish({ ok: false, error: `Tiempo de espera agotado conectando a ${ip}:${port}` });
      });

      socket.on('error', (err) => {
        this.logger.warn(`Printer ${ip}:${port} error: ${err.message}`);
        finish({ ok: false, error: this.friendlyError(err, ip, port) });
      });

      socket.connect(port, ip, () => {
        if (testOnly) {
          finish({ ok: true });
          return;
        }
        const payload = getPayload();
        // Write, then half-close. Resolve only once the data has been flushed
        // and the socket is fully closed, so slow printers don't get truncated.
        socket.end(payload, () => {
          finish({ ok: true });
        });
      });
    });
  }

  private friendlyError(err: NodeJS.ErrnoException, ip: string, port: number): string {
    switch (err.code) {
      case 'ECONNREFUSED':
        return `La impresora rechazó la conexión en ${ip}:${port}. Verificá el puerto.`;
      case 'EHOSTUNREACH':
      case 'ENETUNREACH':
        return `No se alcanza ${ip}. Verificá que esté en la misma red.`;
      case 'ETIMEDOUT':
        return `Tiempo de espera agotado conectando a ${ip}:${port}.`;
      default:
        return `No se pudo conectar a ${ip}:${port} (${err.code ?? err.message}).`;
    }
  }
}
