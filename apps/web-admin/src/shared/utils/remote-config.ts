import { settingsApi } from '@/app/api/client';
import { getApiErrorMessage } from '@/app/api/client';

export function persistRemoteConfig(key: string, scope: string, value: unknown): void {
  void settingsApi.config.upsert({ key, scope, value }, '').catch(error => {
    if (typeof window !== 'undefined') {
      window.alert(getApiErrorMessage(error, 'No se pudo guardar la configuración'));
    }
  });
}
