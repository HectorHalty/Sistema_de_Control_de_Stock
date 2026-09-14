import { useEffect } from 'react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { settingsApi } from '@/app/api/client';
import { persistRemoteConfig } from '@/shared/utils/remote-config';

const tournamentCategories = ['Hombres A', 'Hombres B', 'Hombres C', 'Mujeres A', 'Mujeres B', 'Mujeres C'] as const;

export type FutbolTournamentCategory = (typeof tournamentCategories)[number];

export function useFutbolSettings() {
  const [matchNotifications, setMatchNotificationsState] = useLocalStorage<boolean>(
    storageKeys.futbol.matchNotifications,
    true,
  );
  const [defaultCategory, setDefaultCategoryState] = useLocalStorage<FutbolTournamentCategory>(
    storageKeys.futbol.defaultCategory,
    'Hombres A',
  );

  useEffect(() => {
    void settingsApi.config.list('futbol').then(rows => {
      for (const row of rows) {
        if (row.key === 'futbol.matchNotifications' && typeof row.value === 'boolean') {
          setMatchNotificationsState(row.value);
        }
        if (row.key === 'futbol.defaultCategory' && typeof row.value === 'string') {
          setDefaultCategoryState(row.value as FutbolTournamentCategory);
        }
      }
    }).catch(() => undefined);
  }, [setMatchNotificationsState, setDefaultCategoryState]);

  return {
    matchNotifications,
    setMatchNotifications: (value: boolean) => {
      setMatchNotificationsState(value);
      persistRemoteConfig('futbol.matchNotifications', 'futbol', value);
    },
    defaultCategory,
    setDefaultCategory: (value: FutbolTournamentCategory) => {
      setDefaultCategoryState(value);
      persistRemoteConfig('futbol.defaultCategory', 'futbol', value);
    },
    tournamentCategories,
  };
}

export type FutbolSettingsState = ReturnType<typeof useFutbolSettings>;
