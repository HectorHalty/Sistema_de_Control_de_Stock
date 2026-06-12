import { useAppContext } from '@/app/providers/AppContext';
import { SettingsPanel, SettingsRow, SettingsToggle } from '@/features/platform/settings/SettingsRow';

export function FutbolSettingsPanel() {
  const {
    showPublicFixture,
    setShowPublicFixture,
    matchNotifications,
    setMatchNotifications,
    defaultCategory,
    setDefaultCategory,
    tournamentCategories,
  } = useAppContext();

  return (
    <SettingsPanel title="Configuracion de Futbol" description="Torneos, fixture publico y notificaciones deportivas.">
      <SettingsRow
        title="Notificaciones de Partidos"
        description="Avisar cuando se acerque la fecha de un partido programado"
      >
        <SettingsToggle checked={matchNotifications} onChange={setMatchNotifications} />
      </SettingsRow>

      <SettingsRow
        title="Mostrar Fixture en Sitio Publico"
        description="Publicar el fixture y resultados en la web para socios y visitantes"
      >
        <SettingsToggle checked={showPublicFixture} onChange={setShowPublicFixture} />
      </SettingsRow>

      <SettingsRow
        title="Categoria de Torneo por Defecto"
        description="Categoria preseleccionada al crear equipos o partidos"
        bordered={false}
      >
        <select
          value={defaultCategory}
          onChange={e => setDefaultCategory(e.target.value as typeof defaultCategory)}
          className="px-3 py-1.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
        >
          {tournamentCategories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </SettingsRow>
    </SettingsPanel>
  );
}
