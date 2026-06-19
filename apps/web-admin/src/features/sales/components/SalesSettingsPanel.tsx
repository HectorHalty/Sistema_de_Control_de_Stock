import { useAppContext } from '@/app/providers/AppContext';
import { SettingsPanel, SettingsRow, SettingsToggle } from '@/features/platform/settings/SettingsRow';
import { PrinterSettingsPanel } from './PrinterSettingsPanel';

interface SalesSettingsPanelProps {
  printersOnly?: boolean;
}

export function SalesSettingsPanel({ printersOnly = false }: SalesSettingsPanelProps) {
  const {
    validateStockOnSale,
    setValidateStockOnSale,
    raceConditionProtection,
    setRaceConditionProtection,
  } = useAppContext();

  return (
    <div className="space-y-4">
      {!printersOnly && (
        <SettingsPanel title="Configuracion de Ventas" description="Reglas de venta y comportamiento del punto de venta.">
          <SettingsRow
            title="Validacion de Stock en Venta"
            description="Bloquear venta si no hay stock suficiente de ingredientes"
          >
            <SettingsToggle checked={validateStockOnSale} onChange={setValidateStockOnSale} />
          </SettingsRow>

          <SettingsRow
            title="Proteccion contra Condiciones de Carrera"
            description="Evitar que dos vendedores vendan el mismo ultimo producto"
            bordered={false}
          >
            <SettingsToggle checked={raceConditionProtection} onChange={setRaceConditionProtection} />
          </SettingsRow>
        </SettingsPanel>
      )}

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <PrinterSettingsPanel />
      </div>
    </div>
  );
}
