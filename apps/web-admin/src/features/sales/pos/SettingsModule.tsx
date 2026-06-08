import { useState } from "react";
import {
  Printer as PrinterIcon,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  Star,
  FileText,
  X,
  Shield,
  Settings as SettingsIcon,
  Moon,
  Bell,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useStore, type Printer, type Ticket } from './VentasPosContext';
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
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);

  const opts: { key: string; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; value: boolean; setter: (v: boolean) => void }[] = [
    { key: "dark", label: "Modo oscuro", desc: "Cambia la apariencia de la aplicación", icon: Moon, value: theme === "dark", setter: (v: boolean) => setTheme(v ? "dark" : "light") },
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
              o.value ? "bg-emerald-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${
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
  const { printers, addPrinter, updatePrinter, removePrinter, setDefaultPrinter, togglePrinter } =
    useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);

  const testConnection = (id: string) => {
    setScanning(id);
    setTimeout(() => {
      updatePrinter(id, { connected: true });
      setScanning(null);
    }, 1200);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-gray-900">Impresoras configuradas ({printers.length})</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {printers.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    p.connected ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <PrinterIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-gray-900 flex items-center gap-1">
                    {p.name}
                    {p.isDefault && (
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{p.type}</div>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                  p.connected
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
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

            <div className="text-sm text-gray-600 space-y-1 mb-3">
              <div className="flex justify-between">
                <span>IP</span>
                <span className="font-mono">{p.ip}</span>
              </div>
              <div className="flex justify-between">
                <span>Puerto</span>
                <span className="font-mono">{p.port ?? 9100}</span>
              </div>
              <div className="flex justify-between">
                <span>Papel</span>
                <span>{p.paperWidth} mm</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => testConnection(p.id)}
                disabled={scanning === p.id}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm flex items-center gap-1"
              >
                {scanning === p.id ? "Conectando..." : "Probar conexión"}
              </button>
              <button
                onClick={() => togglePrinter(p.id)}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm"
              >
                {p.connected ? "Desconectar" : "Conectar"}
              </button>
              {!p.isDefault && (
                <button
                  onClick={() => setDefaultPrinter(p.id)}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm flex items-center gap-1"
                >
                  <Star className="w-3 h-3" /> Predeterminada
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar ${p.name}?`)) removePrinter(p.id);
                }}
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-1 ml-auto"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddPrinterModal
          onClose={() => setShowAdd(false)}
          onAdd={(p) => {
            addPrinter(p);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function AddPrinterModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (p: Omit<Printer, "id">) => void;
}) {
  const [draft, setDraft] = useState<Omit<Printer, "id">>({
    name: "",
    type: "Comandera Cocina",
    ip: "",
    port: 9100,
    paperWidth: 80,
    connected: false,
    isDefault: false,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-5">
        <div className="flex justify-between items-center mb-4">
          <h3>Agregar impresora</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Nombre</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej: Comandera Cocina 2"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Tipo</label>
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as Printer["type"] })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option>Comandera Cocina</option>
              <option>Mostrador</option>
              <option>Barra</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">IP</label>
              <input
                value={draft.ip}
                onChange={(e) => setDraft({ ...draft, ip: e.target.value })}
                placeholder="192.168.1.50"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Puerto</label>
              <input
                type="number"
                min={1}
                max={65535}
                value={draft.port}
                onChange={(e) => setDraft({ ...draft, port: +e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono"
              />
            </div>
          </div>
          <div>
              <label className="text-sm text-gray-600 mb-1 block">Ancho papel</label>
              <select
                value={draft.paperWidth}
                onChange={(e) =>
                  setDraft({ ...draft, paperWidth: +e.target.value as 58 | 80 })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                <option value={58}>58 mm</option>
                <option value={80}>80 mm</option>
              </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-gray-700">
            Cancelar
          </button>
          <button
            onClick={() => draft.name && onAdd(draft)}
            disabled={!draft.name}
            className="px-4 py-2 bg-emerald-600 disabled:bg-gray-300 text-white rounded-lg"
          >
            Agregar
          </button>
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
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-gray-900 mb-2">Configurar plantilla</h3>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Encabezado</label>
          <input
            value={template.header}
            onChange={(e) => updateTemplate({ header: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Subtítulo (dirección, CUIT)</label>
          <input
            value={template.subheader}
            onChange={(e) => updateTemplate({ subheader: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Pie de ticket</label>
          <textarea
            value={template.footer}
            onChange={(e) => updateTemplate({ footer: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Tamaño de fuente</label>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(["sm", "md", "lg"] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateTemplate({ fontSize: s })}
                className={`px-3 py-1.5 rounded text-sm ${
                  template.fontSize === s ? "bg-white shadow" : "text-gray-600"
                }`}
              >
                {s === "sm" ? "Pequeño" : s === "md" ? "Mediano" : "Grande"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-100">
          {[
            { k: "showLogo", l: "Mostrar logo" },
            { k: "showDate", l: "Mostrar fecha y hora" },
            { k: "showOperator", l: "Mostrar operador" },
            { k: "showItemDetails", l: "Mostrar precio unitario" },
          ].map((o) => (
            <label key={o.k} className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-700">{o.l}</span>
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

      <div className="bg-gray-100 rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-600 mb-3">Vista previa</div>
        <TicketPreview ticket={sampleTicket} template={template} />
      </div>
    </div>
  );
}
