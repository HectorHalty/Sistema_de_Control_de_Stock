import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';

const tournamentCategories = ['Hombres A', 'Hombres B', 'Hombres C', 'Mujeres A', 'Mujeres B', 'Mujeres C'] as const;

export type FutbolTournamentCategory = (typeof tournamentCategories)[number];

export function useFutbolSettings() {
  const [showPublicFixture, setShowPublicFixture] = useLocalStorage<boolean>(
    storageKeys.futbol.showPublicFixture,
    true,
  );
  const [matchNotifications, setMatchNotifications] = useLocalStorage<boolean>(
    storageKeys.futbol.matchNotifications,
    true,
  );
  const [defaultCategory, setDefaultCategory] = useLocalStorage<FutbolTournamentCategory>(
    storageKeys.futbol.defaultCategory,
    'Hombres A',
  );

  return {
    showPublicFixture,
    setShowPublicFixture,
    matchNotifications,
    setMatchNotifications,
    defaultCategory,
    setDefaultCategory,
    tournamentCategories,
  };
}

export type FutbolSettingsState = ReturnType<typeof useFutbolSettings>;
