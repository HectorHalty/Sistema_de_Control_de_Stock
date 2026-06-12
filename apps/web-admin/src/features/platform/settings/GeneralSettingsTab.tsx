import { useAppContext } from '@/app/providers/AppContext';
import logo10 from '@/assets/logo-10A.png';
import { SettingsPanel, SettingsRow, SettingsToggle } from './SettingsRow';
import { UsersSettingsSection } from './UsersSettingsSection';

interface GeneralSettingsTabProps {
  canManageUsers: boolean;
}

export function GeneralSettingsTab({ canManageUsers }: GeneralSettingsTabProps) {
  const {
    darkMode,
    setDarkMode,
    notificationsEnabled,
    setNotificationsEnabled,
    notificationSound,
    setNotificationSound,
  } = useAppContext();

  return (
    <div className="space-y-6">
      <SettingsPanel title="Aplicacion" description="Preferencias generales del sistema de gestion LCH.">
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <img src={logo10} alt="La Chacra 10 años" className="logo-sidebar w-20 h-20 object-contain" />
          <div>
            <h4 className="text-foreground">La Chacra Futbol</h4>
            <p className="text-sm text-muted-foreground">Sistema de Gestion LCH</p>
          </div>
        </div>

        <SettingsRow
          title="Modo Oscuro"
          description="Cambiar el tema de la aplicacion"
        >
          <SettingsToggle checked={darkMode} onChange={setDarkMode} />
        </SettingsRow>

        <SettingsRow
          title="Notificaciones del Sistema"
          description="Recibir alertas generales de la aplicacion"
        >
          <SettingsToggle checked={notificationsEnabled} onChange={setNotificationsEnabled} />
        </SettingsRow>

        <SettingsRow
          title="Sonido de Alertas"
          description="Reproducir sonido cuando llegue una notificacion"
          bordered={false}
        >
          <SettingsToggle checked={notificationSound} onChange={setNotificationSound} />
        </SettingsRow>
      </SettingsPanel>

      <SettingsPanel title="Administracion de Usuarios" description="Gestion de cuentas y roles del personal LCH.">
        <UsersSettingsSection canManageUsers={canManageUsers} />
      </SettingsPanel>
    </div>
  );
}
