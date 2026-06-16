import type { PrintTicketPayload } from '@/app/api/client';
import type { SalesPrinter, TicketTemplate } from '@/features/sales/types';

/**
 * Builds a sample ticket payload used by the "Imprimir ticket de prueba"
 * button so operators can confirm a printer works end to end.
 */
export function buildTestTicketPayload(
  printer: SalesPrinter,
  template: TicketTemplate,
): PrintTicketPayload {
  return {
    ip: printer.ip,
    port: printer.port,
    paperWidth: printer.paperWidth,
    ticketNumber: 0,
    createdAt: new Date().toLocaleString('es-AR'),
    items: [
      { name: 'Ticket de prueba', quantity: 1, unitPrice: 0 },
      { name: printer.name, quantity: 1, unitPrice: 0 },
    ],
    total: 0,
    header: template.header,
    subheader: 'PRUEBA DE IMPRESION',
    footer: template.footer,
    operatorName: undefined,
    note: `Impresora: ${printer.ip}:${printer.port} - ${printer.paperWidth}mm`,
    kind: 'venta',
    showDate: true,
    showOperator: false,
    showItemDetails: false,
  };
}
