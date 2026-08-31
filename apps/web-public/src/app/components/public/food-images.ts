const BURGER =
  'https://images.unsplash.com/photo-1550547660-d9450f859349?w=700&h=480&fit=crop&auto=format';
const PIZZA =
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=260&fit=crop&auto=format';
const DRINK =
  'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&h=260&fit=crop&auto=format';
const FOOD =
  'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400&h=260&fit=crop&auto=format';

export const CANTEEN_HERO_IMG = BURGER;

export const GALLERY_FALLBACK = [
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=250&h=200&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1434648957308-5e6a859697e8?w=250&h=200&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1517747614396-d21a78b850e8?w=250&h=200&fit=crop&auto=format',
];

export function foodImageFor(name: string, category?: string | null) {
  const hay = `${name} ${category ?? ''}`.toLowerCase();
  if (hay.includes('pizza')) return PIZZA;
  if (hay.includes('cerveza') || hay.includes('bebida') || hay.includes('powerade') || hay.includes('gaseosa'))
    return DRINK;
  if (hay.includes('hamburg') || hay.includes('burger')) return BURGER;
  if (category?.toLowerCase().includes('bebida')) return DRINK;
  if (category?.toLowerCase().includes('pizza')) return PIZZA;
  return FOOD;
}
