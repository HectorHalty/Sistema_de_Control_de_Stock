import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import { settingsApi } from '@/app/api/client';
import { persistRemoteConfig } from '@/shared/utils/remote-config';
import { rememberConfigRows } from '@/shared/utils/config-versions';

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

  const configQuery = useQuery({
    queryKey: ['settings', 'config', 'futbol'],
    queryFn: async () => {
      const rows = await settingsApi.config.list('futbol');
      rememberConfigRows(rows);
      return rows;
    },
  });

  useEffect(() => {
    if (!configQuery.data) return;
    for (const row of configQuery.data) {
      if (row.key === 'futbol.matchNotifications' && typeof row.value === 'boolean') {
        setMatchNotificationsState(row.value);
      }
      if (row.key === 'futbol.defaultCategory' && typeof row.value === 'string') {
        setDefaultCategoryState(row.value as FutbolTournamentCategory);
      }
    }
  }, [configQuery.data, setMatchNotificationsState, setDefaultCategoryState]);

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
