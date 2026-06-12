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
    stockPackRounding,
    setStockPackRounding,
  } = useAppContext();

  return (
    <SettingsPanel title="Configuracion de Stock" description="Alertas, notificaciones y reglas del modulo de inventario.">
      <SettingsRow
        title="Notificaciones de Stock Bajo"
        description="Recibir alertas cuando el stock baje del minimo configurado"
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
        description="Notificar cuando un producto baja de 20 unidades"
      >
        <SettingsToggle checked={stockAutoAlerts} onChange={setStockAutoAlerts} />
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
