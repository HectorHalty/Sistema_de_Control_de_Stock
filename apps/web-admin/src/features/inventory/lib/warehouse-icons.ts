import {
  Warehouse,
  Package,
  Beer,
  Coffee,
  UtensilsCrossed,
  Refrigerator,
  Archive,
  ShoppingCart,
  Flame,
  Sandwich,
  Box,
  Star,
  Zap,
  Droplets,
  type LucideIcon,
} from 'lucide-react';

export const WAREHOUSE_ICONS: Record<string, LucideIcon> = {
  Warehouse,
  Package,
  Beer,
  Coffee,
  UtensilsCrossed,
  Refrigerator,
  Archive,
  ShoppingCart,
  Flame,
  Sandwich,
  Box,
  Star,
  Zap,
  Droplets,
};

export function getWarehouseIcon(iconName?: string): LucideIcon {
  return (iconName && WAREHOUSE_ICONS[iconName]) ? WAREHOUSE_ICONS[iconName] : Warehouse;
}
