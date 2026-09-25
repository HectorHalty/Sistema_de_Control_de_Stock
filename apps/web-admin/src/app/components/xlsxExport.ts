import * as XLSX from 'xlsx';
import { stockCountTypeLabel, type StockCountType } from '@/features/inventory/types';

export type ReportDateType = StockCountType;

export type ConsumptionReportRow = {
  product: string;
  previousStock: number;
  newStock: number;
  consumed: number;
};

const labelForDateType = stockCountTypeLabel;

export function buildConsumptionReportXlsx(options: {
  day: string; // YYYY-MM-DD
  dateType: ReportDateType;
  rows: ConsumptionReportRow[];
  sheetName?: string;
}): Blob {
  const { day, dateType, rows, sheetName } = options;

  const title = `Fecha: ${day} - Tipo: ${labelForDateType(dateType)}`;

  // Build AoA so we can control title row placement.
  const aoa: (string | number)[][] = [
    [title, '', '', ''],
    ['Producto', 'Stock anterior', 'Stock actual', 'Consumido'],
    ...rows.map(r => [r.product, r.previousStock, r.newStock, r.consumed]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merge title across 4 columns.
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

  // Column widths for readability.
  ws['!cols'] = [
    { wch: 36 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || labelForDateType(dateType));

  // Write to array and return as xlsx blob.
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function buildMultiSheetConsumptionReportXlsx(options: {
  day: string;
  sheets: { dateType: ReportDateType; rows: ConsumptionReportRow[] }[];
}): Blob {
  const { day, sheets } = options;

  const wb = XLSX.utils.book_new();

  for (const s of sheets) {
    const title = `Fecha: ${day} - Tipo: ${labelForDateType(s.dateType)}`;
    const aoa: (string | number)[][] = [
      [title, '', '', ''],
      ['Producto', 'Stock anterior', 'Stock actual', 'Consumido'],
      ...s.rows.map(r => [r.product, r.previousStock, r.newStock, r.consumed]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    ws['!cols'] = [
      { wch: 36 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, labelForDateType(s.dateType));
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Un ciclo no siempre cierra: lo que no se puede calcular va vacío, no en cero. */
export type ReconciliationReportRow = {
  product: string;
  initial: number | null;
  entradas: number;
  ventas: number;
  consumos: number;
  roturas: number;
  consumoReal: number | null;
  expected: number | null;
  counted: number | null;
  difference: number | null;
  porcentajeDiferencia: number | null;
};

export function buildReconciliationXlsx(options: {
  title: string;
  rows: ReconciliationReportRow[];
}): Blob {
  const { title, rows } = options;
  const cell = (value: number | null): number | string => (value === null ? '' : value);

  const aoa: (string | number)[][] = [
    [title, '', '', '', '', '', '', '', '', '', ''],
    [
      'Producto',
      'Inicial',
      'Entradas',
      'Ventas',
      'Consumo',
      'Rotura',
      'Consumo real',
      'Esperado',
      'Contado',
      'Diferencia',
      'Dif. %',
    ],
    ...rows.map(r => [
      r.product,
      cell(r.initial),
      r.entradas,
      r.ventas,
      r.consumos,
      r.roturas,
      cell(r.consumoReal),
      cell(r.expected),
      cell(r.counted),
      cell(r.difference),
      cell(r.porcentajeDiferencia),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
  ws['!cols'] = [
    { wch: 36 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 13 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Control de Stock');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function buildOrderXlsx(options: {
  day: string; // YYYY-MM-DD
  orderId: string;
  provider: string;
  rows: { product: string; quantity: number }[];
}): Blob {
  const { day, orderId, provider, rows } = options;
  const title = `Pedido: ${orderId} - Fecha: ${day} - Proveedor: ${provider}`;

  const aoa: (string | number)[][] = [
    [title, '', ''],
    ['Producto', 'Cantidad pedida', ''],
    ...rows.map(r => [r.product, r.quantity, '']),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  ws['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 4 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

