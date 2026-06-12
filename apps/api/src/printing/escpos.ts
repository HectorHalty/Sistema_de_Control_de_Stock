/**
 * ESC/POS command builder for thermal receipt printers.
 *
 * Builds a raw byte Buffer that can be streamed over a TCP socket to a
 * network thermal printer (port 9100). Accents are normalized to ASCII to
 * avoid codepage issues across different printer models.
 */

const ESC = 0x1b;
const GS = 0x1d;

export interface PrintItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface BuildTicketOptions {
  paperWidth: 58 | 80;
  header?: string;
  subheader?: string;
  footer?: string;
  showDate?: boolean;
  showOperator?: boolean;
  showItemDetails?: boolean;
  ticketNumber: number;
  createdAt: string;
  operatorName?: string;
  items: PrintItem[];
  total: number;
  note?: string;
  kind?: 'venta' | 'devolucion';
}

/** Remove diacritics so the printer's default codepage renders cleanly. */
function toAscii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7f]/g, '');
}

/** Characters per line for the given paper width using Font A. */
function lineWidth(paperWidth: 58 | 80): number {
  return paperWidth === 80 ? 48 : 32;
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString('es-AR')}`;
}

/** Left text + right text padded to fill the line width. */
function twoColumns(left: string, right: string, width: number): string {
  const l = toAscii(left);
  const r = toAscii(right);
  const space = width - l.length - r.length;
  if (space < 1) {
    const maxLeft = Math.max(0, width - r.length - 1);
    return `${l.slice(0, maxLeft)} ${r}`;
  }
  return `${l}${' '.repeat(space)}${r}`;
}

class EscPosBuilder {
  private chunks: number[] = [];

  raw(...bytes: number[]): this {
    this.chunks.push(...bytes);
    return this;
  }

  init(): this {
    return this.raw(ESC, 0x40);
  }

  align(mode: 'left' | 'center' | 'right'): this {
    const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0;
    return this.raw(ESC, 0x61, n);
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /** GS ! n — width/height multipliers (0 = 1x, 1 = 2x). */
  size(widthMult: 0 | 1, heightMult: 0 | 1): this {
    const n = (widthMult << 4) | heightMult;
    return this.raw(GS, 0x21, n);
  }

  text(value: string): this {
    const ascii = toAscii(value);
    for (let i = 0; i < ascii.length; i++) {
      this.chunks.push(ascii.charCodeAt(i) & 0xff);
    }
    return this;
  }

  line(value = ''): this {
    return this.text(value).raw(0x0a);
  }

  feed(lines = 1): this {
    for (let i = 0; i < lines; i++) this.chunks.push(0x0a);
    return this;
  }

  /** GS V — partial cut after feeding paper. */
  cut(): this {
    return this.feed(3).raw(GS, 0x56, 66, 0);
  }

  build(): Buffer {
    return Buffer.from(this.chunks);
  }
}

export function buildTicketBuffer(opts: BuildTicketOptions): Buffer {
  const width = lineWidth(opts.paperWidth);
  const divider = '-'.repeat(width);
  const b = new EscPosBuilder();

  b.init();

  if (opts.header) {
    b.align('center').bold(true).size(1, 1).line(opts.header).size(0, 0).bold(false);
  }
  if (opts.subheader) {
    b.align('center').line(opts.subheader);
  }

  b.align('center').line(divider);

  if (opts.kind === 'devolucion') {
    b.align('center').bold(true).line('** DEVOLUCION **').bold(false);
  }

  b.align('left');
  b.line(`Ticket #${opts.ticketNumber}`);
  if (opts.showDate !== false) {
    b.line(opts.createdAt);
  }
  if (opts.showOperator !== false && opts.operatorName) {
    b.line(`Operador: ${opts.operatorName}`);
  }
  if (opts.note) {
    b.line(opts.note);
  }

  b.line(divider);

  // Items: quantity + name in bold double-size; price on the same line.
  const itemWidth = Math.floor(width / 2);
  for (const item of opts.items) {
    const qtyName = `${item.quantity} x ${item.name}`;
    const lineTotal = formatMoney(item.unitPrice * item.quantity);
    b.bold(true)
      .size(1, 1)
      .line(twoColumns(qtyName, lineTotal, itemWidth))
      .size(0, 0)
      .bold(false);
    if (opts.showItemDetails !== false && item.quantity > 1) {
      b.line(`   ${formatMoney(item.unitPrice)} c/u`);
    }
  }

  b.line(divider);

  const totalLabel = opts.kind === 'devolucion' ? 'TOTAL DEVUELTO' : 'TOTAL';
  const totalValue = `${opts.kind === 'devolucion' ? '-' : ''}${formatMoney(opts.total)}`;
  b.bold(true).size(1, 1).line(twoColumns(totalLabel, totalValue, Math.floor(width / 2))).size(0, 0).bold(false);

  if (opts.footer) {
    b.feed(1).align('center').line(opts.footer);
  }

  b.cut();

  return b.build();
}
