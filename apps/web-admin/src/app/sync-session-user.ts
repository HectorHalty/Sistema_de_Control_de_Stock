import type { CurrentUser } from '@/features/platform/types';

export function persistedUserIsStale(
  persisted: CurrentUser,
  session: CurrentUser,
): boolean {
  return (
    persisted.id !== session.id ||
    persisted.role !== session.role ||
    persisted.username !== session.username
  );
}
