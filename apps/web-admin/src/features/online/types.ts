export interface OnlineProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  images: string[];
  category: string;
  attributes: Record<string, string>;
  active: boolean;
  stockProductId?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  imageUrl: string;
  placement: 'banner' | 'fullscreen' | 'sidebar';
  active: boolean;
  linkUrl?: string;
}

export interface MediaItem {
  id: string;
  matchDate?: string;
  type: 'image' | 'video';
  url: string;
  title: string;
  createdAtISO: string;
}
