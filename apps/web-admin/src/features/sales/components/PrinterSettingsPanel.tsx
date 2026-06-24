import { useEffect, useState } from 'react';
import {
  Printer as PrinterIcon,
  Plus,
  FileText,
  X,
} from 'lucide-react';
import { useAppContext } from '@/app/providers/AppContext';
import { usePrintingApiAdapter } from '@/app/api/adapters';
import { buildTestTicketPayload } from '@/features/sales/lib/test-ticket';
import { isNativeLanPrinting } from '@/features/sales/lib/native-printer';
import { PrinterCard } from '@/features/sales/components/PrinterCard';
import type { SalesPrinter, TicketTemplate } from '@/features/sales/types';
import { TicketPreview } from '@/features/sales/pos/TicketPreview';
import type { PosTicket } from '@/features/sales/pos/VentasPosContext';

const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function isValidIpv4(ip: string) {
  if (!IPV4_REGEX.test(ip.trim())) return false;
  return ip.split('.').every(part => {
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

type PrinterDraft = Omit<SalesPrinter, 'id'>;

const emptyPrinterDraft = (): PrinterDraft => ({
  name: '',
  type: 'Comandera Cocina',
  ip: '',
  port: 9100,
  paperWidth: 80,
  connected: false,
  isDefault: false,
});

const previewTicket: PosTicket = {
  id: 'preview',
  number: 1,
  createdAt: new Date().toLocaleString('es-AR'),
  createdAtISO: new Date().toISOString(),
  items: [{ productId: 'preview-1', name: 'Producto de ejemplo', price: 1000, qty: 1, station: 'Cocina' }],
  total: 1000,
  status: 'emitido',
  kind: 'venta',
  source: 'Mostrador',
  operator: 'Operador',
  operatorId: 'preview',
};

export function PrinterSettingsPanel() {
  const {
    salesPrinters,
    addPrinter,
    updatePrinter,
    removePrinter,
    ticketTemplate,
    updateTicketTemplate,
  } = useAppContext();
  const printingApi = usePrintingApiAdapter();

  const [section, setSection] = useState<'printers' | 'template'>('printers');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PrinterDraft>(emptyPrinterDraft());
  const [formError, setFormError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printingTestId, setPrintingTestId] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [testError, setTestError] = useState<string | null>(null);
  const [testInfo, setTestInfo] = useState<string | null>(null);

  const refreshStatus = async (printer: SalesPrinter, force = false) => {
    if (!printingApi.apiAvailable && !isNativeLanPrinting()) return;
    if (!isValidIpv4(printer.ip) || printer.port < 1 || printer.port > 65535) {
      updatePrinter(printer.id, { connected: false });
      return;
    }
    setCheckingIds(prev => new Set(prev).add(printer.id));
    try {
      const result = await printingApi.testPrinter(
        { ip: printer.ip, port: printer.port },
        force,
      );
      updatePrinter(printer.id, { connected: result.ok });
    } finally {
      setCheckingIds(prev => {
        const next = new Set(prev);
        next.delete(printer.id);
        return next;
      });
    }
  };

  useEffect(() => {
    if ((!printingApi.apiAvailable && !isNativeLanPrinting()) || salesPrinters.length === 0) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void Promise.all(
        salesPrinters.map(p => (cancelled ? Promise.resolve() : refreshStatus(p))),
      );
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesPrinters.map(p => `${p.id}:${p.ip}:${p.port}`).join('|'), printingApi.apiAvailable]);

  const toggleExpand = (id: string) => {
    const willExpand = expandedId !== id;
    setExpandedId(willExpand ? id : null);
    if (willExpand) {
      const printer = salesPrinters.find(p => p.id === id);
      if (printer) void refreshStatus(printer, true);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyPrinterDraft());
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (printer: SalesPrinter) => {
    setEditingId(printer.id);
    setDraft({
      name: printer.name,
      type: printer.type,
      ip: printer.ip,
      port: printer.port,
      paperWidth: printer.paperWidth,
      connected: printer.connected,
      isDefault: printer.isDefault,
    });
    setFormError('');
    setShowForm(true);
  };

  const sendTestTicket = async (printer: SalesPrinter) => {
    setPrintingTestId(printer.id);
    setTestError(null);
    setTestInfo(null);
    if (!isValidIpv4(printer.ip) || printer.port < 1 || printer.port > 65535) {
      setTestError(`${printer.name}: IP o puerto inválidos.`);
      setPrintingTestId(null);
      return;
    }
    const result = await printingApi.printTicket(buildTestTicketPayload(printer, ticketTemplate));
    if (result.ok) {
      setTestInfo(`Ticket de prueba enviado a ${printer.name}.`);
    } else {
      setTestError(
        `${printer.name}: ${
          result.apiUnavailable
            ? 'el servidor de impresión no está disponible.'
            : result.error || 'no se pudo imprimir.'
        }`,
      );
    }
    setPrintingTestId(null);
  };

  const savePrinter = () => {
    if (!draft.name.trim()) {
      setFormError('Ingresá un nombre para la impresora.');
      return;
    }
    if (!isValidIpv4(draft.ip)) {
      setFormError('Ingresá una dirección IP válida (ej: 192.168.1.50).');
      return;
    }
    if (draft.port < 1 || draft.port > 65535) {
      setFormError('El puerto debe estar entre 1 y 65535.');
      return;
    }

    if (editingId) {
      updatePrinter(editingId, draft);
    } else {
      addPrinter(draft);
    }
    setShowForm(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setSection('printers')}
          className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 ${
            section === 'printers' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
          }`}
        >
          <PrinterIcon className="w-4 h-4" /> Impresoras
        </button>
        <button
          type="button"
          onClick={() => setSection('template')}
          className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 ${
            section === 'template' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
          }`}
        >
          <FileText className="w-4 h-4" /> Plantilla de ticket
        </button>
      </div>

      {section === 'printers' && (
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="text-foreground">Impresoras de red</h3>
              <p className="text-sm text-muted-foreground">
                Configurá IP, puerto y tipo de cada impresora térmica.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm"
            >
              <Plus className="w-4 h-4" /> Agregar impresora
            </button>
          </div>

          {testError && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
              {testError}
            </div>
          )}

          {testInfo && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-2 text-sm">
              {testInfo}
            </div>
          )}

          {salesPrinters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No hay impresoras configuradas. Agregá una con su dirección IP y puerto (habitualmente 9100).
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {salesPrinters.map(p => (
                <PrinterCard
                  key={p.id}
                  printer={p}
                  expanded={expandedId === p.id}
                  printing={printingTestId === p.id}
                  checkingStatus={checkingIds.has(p.id)}
                  onToggleExpand={() => toggleExpand(p.id)}
                  onEdit={() => openEdit(p)}
                  onPrintTest={() => sendTestTicket(p)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'template' && (
        <TicketTemplateSection template={ticketTemplate} onChange={updateTicketTemplate} />
      )}

      {showForm && (
        <PrinterFormModal
          title={editingId ? 'Editar impresora' : 'Agregar impresora'}
          draft={draft}
          error={formError}
          onChange={setDraft}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          onSave={savePrinter}
          onDelete={
            editingId
              ? () => {
                  const printer = salesPrinters.find(p => p.id === editingId);
                  if (printer && confirm(`¿Eliminar ${printer.name}?`)) {
                    removePrinter(editingId);
                    setShowForm(false);
                    setEditingId(null);
                    setExpandedId(null);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function PrinterFormModal({
  title,
  draft,
  error,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  title: string;
  draft: PrinterDraft;
  error: string;
  onChange: (draft: PrinterDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-md p-5 border border-border shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-foreground">{title}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nombre</label>
            <input
              value={draft.name}
              onChange={e => onChange({ ...draft, name: e.target.value })}
              placeholder="Ej: Comandera Cocina"
              className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Tipo / Sector</label>
            <select
              value={draft.type}
              onChange={e => onChange({ ...draft, type: e.target.value as SalesPrinter['type'] })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
            >
              <option value="Comandera Cocina">Comandera Cocina</option>
              <option value="Mostrador">Mostrador</option>
              <option value="Barra">Barra</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Dirección IP</label>
              <input
                value={draft.ip}
                onChange={e => onChange({ ...draft, ip: e.target.value })}
                placeholder="192.168.1.50"
                className="w-full px-3 py-2 border border-border rounded-lg bg-input-background font-mono"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Puerto</label>
              <input
                type="number"
                min={1}
                max={65535}
                value={draft.port}
                onChange={e => onChange({ ...draft, port: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input-background font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Ancho de papel</label>
            <select
              value={draft.paperWidth}
              onChange={e => onChange({ ...draft, paperWidth: Number(e.target.value) as 58 | 80 })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
            >
              <option value={58}>58 mm</option>
              <option value={80}>80 mm</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={e => onChange({ ...draft, isDefault: e.target.checked })}
              className="w-4 h-4 accent-[#3d7a3d]"
            />
            Usar como impresora predeterminada
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2 mt-5">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              Eliminar
            </button>
          )}
          <div className="flex justify-end gap-2 flex-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-muted-foreground">
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              className="px-4 py-2 bg-[#3d7a3d] text-white rounded-lg hover:bg-[#2f5f2f]"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketTemplateSection({
  template,
  onChange,
}: {
  template: TicketTemplate;
  onChange: (patch: Partial<TicketTemplate>) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-foreground">Plantilla de impresión</h3>
        <p className="text-sm text-muted-foreground">
          Personalizá el contenido del ticket que se envía a la impresora.
        </p>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Encabezado</label>
          <input
            value={template.header}
            onChange={e => onChange({ header: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Subtítulo</label>
          <input
            value={template.subheader}
            onChange={e => onChange({ subheader: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Pie de ticket</label>
          <textarea
            value={template.footer}
            onChange={e => onChange({ footer: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-background resize-none"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Tamaño de fuente</label>
          <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
            {(['sm', 'md', 'lg'] as const).map(size => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ fontSize: size })}
                className={`px-3 py-1.5 rounded text-sm ${
                  template.fontSize === size ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
                }`}
              >
                {size === 'sm' ? 'Pequeño' : size === 'md' ? 'Mediano' : 'Grande'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2 pt-2 border-t border-border">
          {[
            { k: 'showLogo', l: 'Mostrar logo' },
            { k: 'showDate', l: 'Mostrar fecha y hora' },
            { k: 'showOperator', l: 'Mostrar operador' },
            { k: 'showItemDetails', l: 'Mostrar precio unitario' },
          ].map(opt => (
            <label key={opt.k} className="flex items-center justify-between cursor-pointer text-sm">
              <span className="text-foreground">{opt.l}</span>
              <input
                type="checkbox"
                checked={template[opt.k as keyof TicketTemplate] as boolean}
                onChange={e => onChange({ [opt.k]: e.target.checked } as Partial<TicketTemplate>)}
                className="w-4 h-4 accent-[#3d7a3d]"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="bg-muted rounded-xl border border-border p-4">
        <div className="text-sm text-muted-foreground mb-3">Vista previa</div>
        <TicketPreview ticket={previewTicket} template={template} />
      </div>
    </div>
  );
}
