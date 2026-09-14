import { isLocalOnlyId } from '@/shared/utils/local-ids';
import { getApiErrorMessage } from '@/app/api/client';

/** UUID listo para DTOs `@IsUUID()`. Omite ids locales, vacíos o literales como `Admin`. */
export function optionalUuid(id?: string | null): string | undefined {
  if (!id || isLocalOnlyId(id)) return undefined;
  return id;
}

/** Vacío → `null` para que Prisma limpie la columna. `undefined` se omite. */
export function emptyToNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value === null ? '' : value.trim();
  return trimmed ? trimmed : null;
}

export function emptyToNullInt(value?: number | null): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || Number.isNaN(value) || value <= 0) return null;
  return value;
}

export function operatorFields(input: {
  operatorId?: string | null;
  operatorName?: string | null;
}): { operatorId?: string; operatorName?: string } {
  const operatorId = optionalUuid(input.operatorId);
  const operatorName = input.operatorName?.trim() || undefined;
  return {
    ...(operatorId ? { operatorId } : {}),
    ...(operatorName ? { operatorName } : {}),
  };
}

/** No bloquea la UI: la lista se re-sincroniza después de pintar la respuesta. */
export function scheduleBackgroundHydrate(
  task: () => Promise<unknown>,
  onError?: (error: unknown) => void,
): void {
  void task().catch(error => {
    onError?.(error);
  });
}

export function reportMutationError(error: unknown, fallback: string): string {
  const message = getApiErrorMessage(error, fallback);
  if (typeof window !== 'undefined') window.alert(message);
  return message;
}
