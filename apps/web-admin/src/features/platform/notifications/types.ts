export type NotificationSeverity = 'warning' | 'info' | 'error';

export type NotificationKind = 'low_stock' | 'pending_order' | 'kitchen_order';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  href: string;
  severity: NotificationSeverity;
}
