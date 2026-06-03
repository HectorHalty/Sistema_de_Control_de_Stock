import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { storageKeys } from '@/shared/storage/keys';
import type { MediaItem, OnlineProduct, Sponsor } from './types';

export function useOnlineState() {
  const [onlineProducts, setOnlineProducts] = useLocalStorage<OnlineProduct[]>(storageKeys.online.products, []);
  const [sponsors, setSponsors] = useLocalStorage<Sponsor[]>(storageKeys.online.sponsors, []);
  const [mediaItems, setMediaItems] = useLocalStorage<MediaItem[]>(storageKeys.online.media, []);

  return { onlineProducts, setOnlineProducts, sponsors, setSponsors, mediaItems, setMediaItems };
}

export type OnlineState = ReturnType<typeof useOnlineState>;
