import { useAppContext } from '@/app/providers/AppContext';
import { SettingsPanel, SettingsRow, SettingsToggle } from '@/features/platform/settings/SettingsRow';

const weekDays = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

export function StockSettingsPanel() {
  const {
    stockLowNotifications,
    setStockLowNotifications,
    stockAlertDay,
    setStockAlertDay,
    stockAutoAlerts,
    setStockAutoAlerts,
    stockAutoAlertMinimum,
    setStockAutoAlertMinimum,
    stockPackRounding,
    setStockPackRounding,
  } = useAppContext();

  return (
    <SettingsPanel title="Configuracion de Stock" description="Alertas, notificaciones y reglas del modulo de inventario.">
      <SettingsRow
        title="Notificaciones de Stock Bajo"
        description="Avisa el dia elegido cuando el stock mas los pedidos pendientes no cubren el promedio semanal de ventas"
      >
        <SettingsToggle checked={stockLowNotifications} onChange={setStockLowNotifications} />
      </SettingsRow>

      <SettingsRow
        title="Dia de Alerta de Stock Faltante"
        description="Elegi que dia de la semana queres que te avise si falta stock"
      >
        <select
          value={stockAlertDay}
          onChange={e => setStockAlertDay(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
        >
          {weekDays.map(day => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
      </SettingsRow>

      <SettingsRow
        title="Alertas Automaticas"
        description="Avisa cuando el stock baja de este minimo, aunque no haya ventas"
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            aria-label="Minimo de alerta automatica"
            value={stockAutoAlertMinimum}
            onChange={e => {
              const next = Number(e.target.value);
              if (Number.isInteger(next) && next >= 1) setStockAutoAlertMinimum(next);
            }}
            className="w-16 px-2 py-1.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm text-right"
          />
          <SettingsToggle checked={stockAutoAlerts} onChange={setStockAutoAlerts} />
        </div>
      </SettingsRow>

      <SettingsRow
        title="Unidad de Pedido por Defecto"
        description="Redondeo automatico a multiplos del pack al generar pedidos"
        bordered={false}
      >
        <SettingsToggle checked={stockPackRounding} onChange={setStockPackRounding} />
      </SettingsRow>
    </SettingsPanel>
  );
}
