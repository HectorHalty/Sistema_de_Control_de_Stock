import { useAppContext } from '@/app/providers/AppContext';
import { SettingsPanel, SettingsRow, SettingsToggle } from '@/features/platform/settings/SettingsRow';

export function OnlineSettingsPanel() {
  const {
    orderNotifications,
    setOrderNotifications,
    syncCatalogWithStock,
    setSyncCatalogWithStock,
    webChannelEnabled,
    setWebChannelEnabled,
    appChannelEnabled,
    setAppChannelEnabled,
  } = useAppContext();

  return (
    <SettingsPanel title="Configuracion de Ventas Online" description="Canales, catalogo y notificaciones del modulo online.">
      <SettingsRow
        title="Notificaciones de Pedidos Online"
        description="Recibir alertas cuando ingrese un nuevo pedido web o app"
      >
        <SettingsToggle checked={orderNotifications} onChange={setOrderNotifications} />
      </SettingsRow>

      <SettingsRow
        title="Sincronizar Catalogo con Stock"
        description="Actualizar disponibilidad online segun el stock del inventario"
      >
        <SettingsToggle checked={syncCatalogWithStock} onChange={setSyncCatalogWithStock} />
      </SettingsRow>

      <SettingsRow
        title="Canal Web Activo"
        description="Permitir pedidos desde el sitio web publico"
      >
        <SettingsToggle checked={webChannelEnabled} onChange={setWebChannelEnabled} />
      </SettingsRow>

      <SettingsRow
        title="Canal App Activo"
        description="Permitir pedidos desde la aplicacion movil de clientes"
        bordered={false}
      >
        <SettingsToggle checked={appChannelEnabled} onChange={setAppChannelEnabled} />
      </SettingsRow>
    </SettingsPanel>
  );
}
