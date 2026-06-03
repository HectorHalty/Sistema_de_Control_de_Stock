import { useCallback, useState } from 'react';

const STORAGE_KEY = 'sales-favorite-product-ids';

function readFavoriteIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function useFavoriteProductIds() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(readFavoriteIds);

  const persist = useCallback((ids: string[]) => {
    setFavoriteIds(ids);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFavorite = useCallback(
    (productId: string) => {
      persist(
        favoriteIds.includes(productId)
          ? favoriteIds.filter(id => id !== productId)
          : [...favoriteIds, productId],
      );
    },
    [favoriteIds, persist],
  );

  const isFavorite = useCallback((productId: string) => favoriteIds.includes(productId), [favoriteIds]);

  return { favoriteIds, toggleFavorite, isFavorite };
}
