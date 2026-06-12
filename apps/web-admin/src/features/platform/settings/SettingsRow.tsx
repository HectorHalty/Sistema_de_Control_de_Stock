import type { ReactNode } from 'react';

interface SettingsRowProps {
  title: string;
  description: string;
  children: ReactNode;
  bordered?: boolean;
}

export function SettingsRow({ title, description, children, bordered = true }: SettingsRowProps) {
  return (
    <div className={`flex items-center justify-between py-3 gap-4 ${bordered ? 'border-b border-border' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm" style={{ fontWeight: 500 }}>{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

interface SettingsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SettingsToggle({ checked, onChange }: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors ${checked ? 'bg-[#3d7a3d]' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${checked ? 'right-0.5' : 'left-0.5'}`}
      />
    </button>
  );
}

export function SettingsPanel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
