import { Printer as PrinterIcon, Wifi, WifiOff, Pencil } from 'lucide-react';
import { ExpandChevron } from '@/shared/components/ExpandChevron';
import type { SalesPrinter } from '@/features/sales/types';

type PrinterCardProps = {
  printer: SalesPrinter;
  expanded: boolean;
  printing: boolean;
  checkingStatus?: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onPrintTest: () => void;
};

export function PrinterCard({
  printer,
  expanded,
  printing,
  checkingStatus,
  onToggleExpand,
  onEdit,
  onPrintTest,
}: PrinterCardProps) {
  return (
    <div
      className={`rounded-xl border bg-white dark:bg-card overflow-hidden transition ${
        expanded ? 'border-emerald-300 shadow-sm' : 'border-gray-200 dark:border-border'
      }`}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-muted/40 transition"
      >
        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
          <PrinterIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-gray-900 dark:text-foreground font-medium truncate">{printer.name}</div>
          <div className="text-xs text-gray-500 dark:text-muted-foreground">{printer.type}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
              checkingStatus
                ? 'bg-gray-100 text-gray-500'
                : printer.connected
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20'
            }`}
          >
            {checkingStatus ? (
              'Verificando...'
            ) : printer.connected ? (
              <>
                <Wifi className="w-3 h-3" /> Conectada
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" /> Desconectada
              </>
            )}
          </span>
          <ExpandChevron expanded={expanded} size={16} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-border">
          <div className="text-sm space-y-1 pt-3 pl-1">
            <div className="flex gap-1.5">
              <span className="text-gray-500 dark:text-muted-foreground">Dirección IP</span>
              <span className="font-mono text-gray-900 dark:text-foreground">{printer.ip}</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-gray-500 dark:text-muted-foreground">Puerto</span>
              <span className="font-mono text-gray-900 dark:text-foreground">{printer.port}</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-gray-500 dark:text-muted-foreground">Ancho de papel</span>
              <span className="text-gray-900 dark:text-foreground">{printer.paperWidth} mm</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={onPrintTest}
              disabled={printing}
              className="flex-1 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 rounded-lg text-sm disabled:opacity-60 transition"
            >
              {printing ? 'Imprimiendo...' : 'Imprimir ticket de prueba'}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-muted dark:text-foreground rounded-lg transition"
              title="Editar impresora"
              aria-label={`Editar ${printer.name}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
