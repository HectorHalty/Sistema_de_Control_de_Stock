import { getCategoryIcon } from './category-icons';

type IconSize = 'sm' | 'md' | 'lg';

const SIZE_CONFIG: Record<IconSize, { box: string; icon: number; radius: string }> = {
  sm: { box: 'w-10 h-10', icon: 20, radius: 'rounded-xl' },
  md: { box: 'w-12 h-12', icon: 22, radius: 'rounded-xl' },
  lg: { box: 'w-14 h-14', icon: 26, radius: 'rounded-2xl' },
};

type CategoryIconBadgeProps = {
  iconName: string;
  size?: IconSize;
  className?: string;
};

export function CategoryIconBadge({ iconName, size = 'md', className = '' }: CategoryIconBadgeProps) {
  const Icon = getCategoryIcon(iconName);
  const config = SIZE_CONFIG[size];

  return (
    <div
      className={`${config.box} ${config.radius} flex flex-shrink-0 items-center justify-center border border-[#3d7a3d]/20 bg-[#3d7a3d]/10 ${className}`}
      aria-hidden
    >
      <Icon size={config.icon} strokeWidth={2} className="text-[#3d7a3d]" />
    </div>
  );
}
