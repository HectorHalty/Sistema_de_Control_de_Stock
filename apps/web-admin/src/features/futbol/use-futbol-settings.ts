import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';

const tournamentCategories = ['Hombres A', 'Hombres B', 'Hombres C', 'Mujeres A', 'Mujeres B', 'Mujeres C'] as const;

export type FutbolTournamentCategory = (typeof tournamentCategories)[number];

export function useFutbolSettings() {
  const [matchNotifications, setMatchNotifications] = useLocalStorage<boolean>(
    storageKeys.futbol.matchNotifications,
    true,
  );
  const [defaultCategory, setDefaultCategory] = useLocalStorage<FutbolTournamentCategory>(
    storageKeys.futbol.defaultCategory,
    'Hombres A',
  );

  return {
    matchNotifications,
    setMatchNotifications,
    defaultCategory,
    setDefaultCategory,
    tournamentCategories,
  };
}

export type FutbolSettingsState = ReturnType<typeof useFutbolSettings>;
