import { useState } from 'react';
import { footballApi, getAccessToken } from '@/app/api/client';
import { SettingsPanel, SettingsRow, SettingsToggle } from '@/features/platform/settings/SettingsRow';
import { useAppContext } from '@/app/providers/AppContext';
import { useFutbolOverview } from '../futbol-shared';

export function FutbolSettingsPanel() {
  const {
    matchNotifications,
    setMatchNotifications,
    defaultCategory,
    setDefaultCategory,
    tournamentCategories,
  } = useAppContext();

  const { data, reload } = useFutbolOverview();
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const torneo = data?.torneo;
  const publicado = torneo?.publicado ?? false;

  async function togglePublicFixture() {
    const token = getAccessToken();
    if (!token || !torneo) return;
    setToggling(true);
    setError(null);
    try {
      await footballApi.updateTorneo(torneo.id, { publicado: !publicado }, token);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    } finally {
      setToggling(false);
    }
  }

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
        description={
          torneo
            ? `Torneo activo: ${torneo.nombre}. ${publicado ? 'Visible en la web.' : 'Oculto — borrador.'}`
            : 'No hay torneo activo configurado.'
        }
      >
        <SettingsToggle
          checked={publicado}
          onChange={() => void togglePublicFixture()}
          disabled={!torneo || toggling}
        />
      </SettingsRow>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <SettingsRow
        title="Categoria de Torneo por Defecto"
        description="Categoria preseleccionada al crear equipos o partidos"
        bordered={false}
      >
        <select
          value={defaultCategory}
          onChange={(e) => setDefaultCategory(e.target.value as typeof defaultCategory)}
          className="px-3 py-1.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
        >
          {tournamentCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </SettingsRow>
    </SettingsPanel>
  );
}
