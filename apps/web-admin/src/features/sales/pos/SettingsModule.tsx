import { useEffect, useState } from "react";
import {
  Printer as PrinterIcon,
  Plus,
  FileText,
  X,
  Shield,
  Settings as SettingsIcon,
  Moon,
  Bell,
} from "lucide-react";
import { usePrintingApiAdapter } from '@/app/api/adapters';
import { useStore, type Printer, type Ticket } from './VentasPosContext';
import { PrinterCard } from '@/features/sales/components/PrinterCard';
import { TicketPreview } from "./TicketPreview";
import { UsersModule } from "./UsersModule";

type Tab = "general" | "printers" | "template" | "roles";

export function SettingsModule() {
  const [tab, setTab] = useState<Tab>("general");

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "general", label: "General", icon: SettingsIcon },
    { id: "printers", label: "Impresoras", icon: PrinterIcon },
    { id: "template", label: "Plantilla", icon: FileText },
    { id: "roles", label: "Roles", icon: Shield },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 w-fit max-w-full">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded flex items-center gap-2 transition whitespace-nowrap ${
              tab === t.id ? "bg-emerald-600 text-white" : "text-gray-600 dark:text-gray-300"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && <GeneralTab />}
      {tab === "printers" && <PrintersTab />}
      {tab === "template" && <TemplateTab />}
      {tab === "roles" && <UsersModule />}
    </div>
  );
}

function GeneralTab() {
  const [darkMode, setDarkMode] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );
  const [notifications, setNotifications] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);

  const toggleDarkMode = (value: boolean) => {
    setDarkMode(value);
    document.documentElement.classList.toggle("dark", value);
    try {
      localStorage.setItem("stock-darkmode", JSON.stringify(value));
    } catch {
      // localStorage no disponible — el cambio visual se aplica igualmente
    }
  };

  const opts: { key: string; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; value: boolean; setter: (v: boolean) => void }[] = [
    { key: "dark", label: "Modo oscuro", desc: "Cambia la apariencia de la aplicación", icon: Moon, value: darkMode, setter: toggleDarkMode },
    { key: "notif", label: "Notificaciones", desc: "Avisos de pedidos y stock bajo", icon: Bell, value: notifications, setter: setNotifications },
    { key: "sound", label: "Alertas sonoras", desc: "Sonido al imprimir tickets", icon: Bell, value: soundAlerts, setter: setSoundAlerts },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 max-w-2xl">
      <h3 className="text-gray-900 dark:text-gray-100 mb-2">Preferencias de la aplicación</h3>
      {opts.map((o) => (
        <div key={o.key} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0">
              <o.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-gray-900 dark:text-gray-100">{o.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{o.desc}</div>
            </div>
          </div>
          <button
            onClick={() => o.setter(!o.value)}
            className={`w-11 h-6 rounded-full transition relative shrink-0 ${
              o.value ? "bg-emerald-600" : "bg-secondary"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-card rounded-full transition ${
                o.value ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

function PrintersTab() {
  const { printers, addPrinter, updatePrinter, removePrinter, printTestTicket, testPrinter, setToast } =
    useStore();
  const printingApi = usePrintingApiAdapter();
  const [showForm, setShowForm] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printingTest, setPrintingTest] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());

  const refreshStatus = async (printer: Printer) => {
    if (!printingApi.apiAvailable) return;
    setCheckingIds(prev => new Set(prev).add(printer.id));
    try {
      const result = await testPrinter(printer);
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
    if (!printingApi.apiAvailable) return;
    let cancelled = false;
    (async () => {
      for (const p of printers) {
        if (cancelled) break;
        await refreshStatus(p);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printers.map(p => `${p.id}:${p.ip}:${p.port}`).join('|'), printingApi.apiAvailable]);

  const openCreate = () => {
    setEditingPrinter(null);
    setShowForm(true);
  };

  const openEdit = (printer: Printer) => {
    setEditingPrinter(printer);
    setShowForm(true);
  };

  const toggleExpand = (id: string) => {
    const willExpand = expandedId !== id;
    setExpandedId(willExpand ? id : null);
    if (willExpand) {
      const printer = printers.find(p => p.id === id);
      if (printer) void refreshStatus(printer);
    }
  };

  const sendTestTicket = async (id: string) => {
    const printer = printers.find((p) => p.id === id);
    if (!printer) return;
    setPrintingTest(id);
    const result = await printTestTicket(printer);
    if (result.ok) {
      setToast(`🧾 Ticket de prueba enviado a ${printer.name}`);
    } else {
      const reason = result.apiUnavailable
        ? "el servidor de impresión no está disponible"
        : result.error || "no respondió";
      setToast(`⚠️ ${printer.name}: ${reason}`);
    }
    setTimeout(() => setToast(null), 3500);
    setPrintingTest(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-foreground">Impresoras configuradas ({printers.length})</h3>
        <button
          onClick={openCreate}
          className="bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {printers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No hay impresoras configuradas. Agregá una con su dirección IP y puerto (habitualmente 9100).
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {printers.map((p) => (
            <PrinterCard
              key={p.id}
              printer={p}
              expanded={expandedId === p.id}
              printing={printingTest === p.id}
              checkingStatus={checkingIds.has(p.id)}
              onToggleExpand={() => toggleExpand(p.id)}
              onEdit={() => openEdit(p)}
              onPrintTest={() => sendTestTicket(p.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <PrinterFormModal
          key={editingPrinter?.id ?? "new"}
          printer={editingPrinter}
          onClose={() => setShowForm(false)}
          onSave={(draft) => {
            if (editingPrinter) {
              updatePrinter(editingPrinter.id, draft);
            } else {
              addPrinter(draft);
            }
            setShowForm(false);
          }}
          onDelete={
            editingPrinter
              ? () => {
                  removePrinter(editingPrinter.id);
                  setShowForm(false);
                  setExpandedId(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function PrinterFormModal({
  printer,
  onClose,
  onSave,
  onDelete,
}: {
  printer: Printer | null;
  onClose: () => void;
  onSave: (p: Omit<Printer, "id">) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<Omit<Printer, "id">>({
    name: printer?.name ?? "",
    type: printer?.type ?? "Comandera Cocina",
    ip: printer?.ip ?? "",
    port: printer?.port ?? 9100,
    paperWidth: printer?.paperWidth ?? 80,
    connected: printer?.connected ?? false,
    isDefault: printer?.isDefault ?? false,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-md p-5">
        <div className="flex justify-between items-center mb-4">
          <h3>{printer ? "Editar impresora" : "Agregar impresora"}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nombre</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej: Comandera Cocina 2"
              className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Tipo</label>
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as Printer["type"] })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
            >
              <option>Comandera Cocina</option>
              <option>Mostrador</option>
              <option>Barra</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">IP</label>
              <input
                value={draft.ip}
                onChange={(e) => setDraft({ ...draft, ip: e.target.value })}
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
                onChange={(e) => setDraft({ ...draft, port: +e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input-background font-mono"
              />
            </div>
          </div>
          <div>
              <label className="text-sm text-muted-foreground mb-1 block">Ancho papel</label>
              <select
                value={draft.paperWidth}
                onChange={(e) =>
                  setDraft({ ...draft, paperWidth: +e.target.value as 58 | 80 })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
              >
                <option value={58}>58 mm</option>
                <option value={80}>80 mm</option>
              </select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5">
          {printer && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Eliminar ${printer.name}?`)) onDelete();
              }}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              Eliminar
            </button>
          )}
          <div className="flex justify-end gap-2 flex-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => draft.name && onSave(draft)}
              disabled={!draft.name}
              className="px-4 py-2 bg-emerald-600 disabled:bg-gray-300 text-white rounded-lg"
            >
              {printer ? "Guardar" : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateTab() {
  const { template, updateTemplate } = useStore();

  const sampleTicket: Ticket = {
    id: "preview",
    number: 1,
    createdAt: new Date().toLocaleString("es-AR"),
    createdAtISO: new Date().toISOString(),
    items: [
      { productId: "preview-1", name: "Producto de ejemplo", price: 1000, qty: 1 },
    ],
    total: 1000,
    status: "emitido",
    kind: "venta",
    source: "Mostrador",
    operator: "Operador",
    operatorId: "preview",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-foreground mb-2">Configurar plantilla</h3>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Encabezado</label>
          <input
            value={template.header}
            onChange={(e) => updateTemplate({ header: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Subtítulo (dirección, CUIT)</label>
          <input
            value={template.subheader}
            onChange={(e) => updateTemplate({ subheader: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Pie de ticket</label>
          <textarea
            value={template.footer}
            onChange={(e) => updateTemplate({ footer: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-background resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Tamaño de fuente</label>
          <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
            {(["sm", "md", "lg"] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateTemplate({ fontSize: s })}
                className={`px-3 py-1.5 rounded text-sm ${
                  template.fontSize === s ? "bg-card shadow" : "text-muted-foreground"
                }`}
              >
                {s === "sm" ? "Pequeño" : s === "md" ? "Mediano" : "Grande"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          {[
            { k: "showLogo", l: "Mostrar logo" },
            { k: "showDate", l: "Mostrar fecha y hora" },
            { k: "showOperator", l: "Mostrar operador" },
            { k: "showItemDetails", l: "Mostrar precio unitario" },
          ].map((o) => (
            <label key={o.k} className="flex items-center justify-between cursor-pointer">
              <span className="text-foreground">{o.l}</span>
              <input
                type="checkbox"
                checked={template[o.k as keyof typeof template] as boolean}
                onChange={(e) => updateTemplate({ [o.k]: e.target.checked } as never)}
                className="w-4 h-4 accent-emerald-600"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="bg-muted rounded-xl border border-border p-4">
        <div className="text-sm text-muted-foreground mb-3">Vista previa</div>
        <TicketPreview ticket={sampleTicket} template={template} />
      </div>
    </div>
  );
}
