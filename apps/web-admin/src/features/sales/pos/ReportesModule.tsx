import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { BarChart3, Clock, FileSpreadsheet, TrendingUp } from "lucide-react";
import { useAppContext } from '@/app/providers/AppContext';
import {
  canAccessVentasReportSection,
  getDefaultVentasReportSection,
  type VentasReportSection,
} from '@/features/platform/config/modules';
import { DashboardModule } from "./DashboardModule";
import { HistoryModule } from "./HistoryModule";
import { SalesExportReport } from "./SalesExportReport";
import { ModulePlaceholderPage } from '@/features/platform/pages/ModulePlaceholderPage';

const SECTIONS: { id: VentasReportSection; label: string; icon: typeof BarChart3 }[] = [
  { id: "ventas", label: "Por cocina", icon: FileSpreadsheet },
  { id: "metricas", label: "Métricas", icon: TrendingUp },
  { id: "historial", label: "Historial", icon: Clock },
];

function resolveSection(value: string | null): SalesReportSection {
  if (value === "metricas" || value === "historial" || value === "ventas") {
    return value;
  }
  return "ventas";
}

type SalesReportSection = VentasReportSection;

export function ReportesModule() {
  const { currentUser } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = resolveSection(searchParams.get("section"));
  const section = canAccessVentasReportSection(currentUser.role, requestedSection)
    ? requestedSection
    : getDefaultVentasReportSection(currentUser.role);

  useEffect(() => {
    if (!searchParams.get("section") || searchParams.get("section") !== section) {
      const sp = new URLSearchParams(searchParams);
      sp.set("section", section);
      sp.set("tab", "reportes");
      setSearchParams(sp, { replace: true });
    }
  }, [searchParams, setSearchParams, section]);

  const visibleSections = SECTIONS.filter(item =>
    canAccessVentasReportSection(currentUser.role, item.id),
  );

  if (visibleSections.length === 0) {
    return (
      <ModulePlaceholderPage
        title="Reportes"
        description="Tu perfil no tiene acceso a los reportes de ventas."
        denied
      />
    );
  }

  const setSection = (next: SalesReportSection) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", "reportes");
    sp.set("section", next);
    setSearchParams(sp, { replace: true });
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div>
        <h3 className="text-2xl text-gray-900 dark:text-gray-100">Reportes</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ventas por cocina, métricas e historial de tickets
        </p>
      </div>

      {visibleSections.length > 1 && (
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm">
          {visibleSections.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm transition-colors ${
                  active ? "bg-[#3d7a3d] text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {section === "ventas" && <SalesExportReport />}
        {section === "metricas" && <DashboardModule />}
        {section === "historial" && <HistoryModule />}
      </div>
    </div>
  );
}

export type { VentasReportSection as SalesReportSection };
