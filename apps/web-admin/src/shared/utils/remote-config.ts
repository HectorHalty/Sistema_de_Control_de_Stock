import { settingsApi, getApiErrorMessage } from '@/app/api/client';
import { notifyError } from '@/shared/notify';
import { buildUpsertPayload, rememberConfigRow } from './config-versions';

export function persistRemoteConfig(key: string, scope: string, value: unknown): void {
  const payload = buildUpsertPayload(key, scope, value);
  void settingsApi.config.upsert(payload, '').then(
    (row) => {
      rememberConfigRow(row);
    },
    (error) => {
      const message = getApiErrorMessage(error, 'No se pudo guardar la configuración');
      notifyError(message);
      if (typeof window !== 'undefined') {
        window.alert(message);
      }
    },
  );
}
