import { useState } from 'react';
import { Bell, AlertTriangle, ClipboardList, Package, UtensilsCrossed } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/ui/popover';
import { useAppContext } from '@/app/providers/AppContext';
import { usePendingNotifications } from '@/features/platform/notifications/use-pending-notifications';
import type { AppNotification, NotificationKind } from '@/features/platform/notifications/types';

const kindIcons: Record<NotificationKind, typeof Bell> = {
  low_stock: Package,
  pending_order: ClipboardList,
  kitchen_order: UtensilsCrossed,
};

const severityStyles: Record<AppNotification['severity'], string> = {
  error: 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400',
  warning: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  info: 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
};

function NotificationItem({
  notification,
  onNavigate,
}: {
  notification: AppNotification;
  onNavigate: (href: string) => void;
}) {
  const Icon = kindIcons[notification.kind];

  return (
    <button
      type="button"
      onClick={() => onNavigate(notification.href)}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted"
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${severityStyles[notification.severity]}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{notification.description}</p>
      </div>
    </button>
  );
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { notificationsEnabled } = useAppContext();
  const notifications = usePendingNotifications();
  const count = notifications.length;

  const handleNavigate = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-xl p-2 text-foreground transition-colors hover:bg-muted"
          aria-label={count > 0 ? `${count} notificaciones pendientes` : 'Notificaciones'}
        >
          <Bell size={20} />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
          <p className="text-xs text-muted-foreground">
            {count > 0 ? `${count} pendiente(s)` : 'Sin novedades'}
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {!notificationsEnabled ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <AlertTriangle size={20} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Las notificaciones están desactivadas.
              </p>
              <button
                type="button"
                onClick={() => navigate('/configuracion')}
                className="text-xs font-medium text-[#3d7a3d] hover:text-[#2f5f2f]"
              >
                Ir a Configuración
              </button>
            </div>
          ) : count === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <Bell size={20} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No hay notificaciones pendientes</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
