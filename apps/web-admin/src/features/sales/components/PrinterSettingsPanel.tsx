import { useState } from 'react';
import {
  Printer as PrinterIcon,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  Star,
  FileText,
  X,
  Edit2,
} from 'lucide-react';
import { useAppContext } from '@/app/providers/AppContext';
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
  items: [{ productId: 'preview-1', name: 'Producto de ejemplo', price: 1000, qty: 1 }],
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
    setDefaultPrinter,
    togglePrinter,
    ticketTemplate,
    updateTicketTemplate,
  } = useAppContext();

  const [section, setSection] = useState<'printers' | 'template'>('printers');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PrinterDraft>(emptyPrinterDraft());
  const [formError, setFormError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

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

  const testConnection = (printer: SalesPrinter) => {
    setTestingId(printer.id);
    window.setTimeout(() => {
      const ok = isValidIpv4(printer.ip) && printer.port > 0 && printer.port <= 65535;
      updatePrinter(printer.id, { connected: ok });
      setTestingId(null);
    }, 800);
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

          {salesPrinters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No hay impresoras configuradas. Agregá una con su dirección IP y puerto (habitualmente 9100).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {salesPrinters.map(p => (
                <div key={p.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          p.connected
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <PrinterIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-foreground flex items-center gap-1 truncate">
                          {p.name}
                          {p.isDefault && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.type}</div>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 shrink-0 ${
                        p.connected
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20'
                      }`}
                    >
                      {p.connected ? (
                        <>
                          <Wifi className="w-3 h-3" /> Conectada
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3" /> Desconectada
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1 mb-3">
                    <div className="flex justify-between gap-2">
                      <span>IP</span>
                      <span className="font-mono text-foreground">{p.ip || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Puerto</span>
                      <span className="font-mono text-foreground">{p.port}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Papel</span>
                      <span className="text-foreground">{p.paperWidth} mm</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => testConnection(p)}
                      disabled={testingId === p.id}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded-lg text-sm"
                    >
                      {testingId === p.id ? 'Probando...' : 'Probar conexión'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="px-3 py-1.5 bg-muted text-foreground rounded-lg text-sm flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePrinter(p.id)}
                      className="px-3 py-1.5 bg-muted text-foreground rounded-lg text-sm"
                    >
                      {p.connected ? 'Desconectar' : 'Conectar'}
                    </button>
                    {!p.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDefaultPrinter(p.id)}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 dark:bg-amber-900/20 rounded-lg text-sm flex items-center gap-1"
                      >
                        <Star className="w-3 h-3" /> Predeterminada
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar ${p.name}?`)) removePrinter(p.id);
                      }}
                      className="px-3 py-1.5 bg-red-50 text-red-600 dark:bg-red-900/20 rounded-lg text-sm flex items-center gap-1 ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
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
}: {
  title: string;
  draft: PrinterDraft;
  error: string;
  onChange: (draft: PrinterDraft) => void;
  onClose: () => void;
  onSave: () => void;
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

        <div className="flex justify-end gap-2 mt-5">
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
