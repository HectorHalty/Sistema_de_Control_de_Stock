import type { ComponentType } from 'react';
import {
  Apple,
  Beef,
  Coffee,
  Cookie,
  Croissant,
  Droplets,
  Egg,
  Fish,
  Flame,
  Heart,
  Package,
  Sandwich,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Wheat,
  Wine,
  Wrench,
  Zap,
} from 'lucide-react';

const ICON_MAP: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  Wine,
  Cookie,
  Croissant,
  Beef,
  Wrench,
  ShoppingCart,
  Coffee,
  Sandwich,
  Apple,
  Fish,
  Egg,
  Wheat,
  Sparkles,
  Flame,
  Droplets,
  Zap,
  Star,
  Heart,
  Package,
  Tag,
};

export const AVAILABLE_CATEGORY_ICON_NAMES = Object.keys(ICON_MAP);

export function getCategoryIcon(iconName: string): ComponentType<{ size?: number; className?: string }> {
  return ICON_MAP[iconName] || Package;
}
