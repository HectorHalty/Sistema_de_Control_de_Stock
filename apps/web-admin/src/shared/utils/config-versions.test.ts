import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildUpsertPayload,
  clearConfigVersionsForTests,
  rememberConfigRow,
  rememberConfigRows,
} from './config-versions';

describe('config-versions', () => {
  beforeEach(() => {
    clearConfigVersionsForTests();
  });

  it('sin fila previa, el upsert va sin version (alta)', () => {
    expect(buildUpsertPayload('sales.ticketTemplate', 'sales', { a: 1 })).toEqual({
      key: 'sales.ticketTemplate',
      scope: 'sales',
      value: { a: 1 },
    });
  });

  it('después de listar, el upsert manda la version leída', () => {
    rememberConfigRows([
      { key: 'sales.ticketTemplate', scope: 'sales', value: { a: 1 }, version: 3 },
    ]);
    expect(buildUpsertPayload('sales.ticketTemplate', 'sales', { a: 2 })).toEqual({
      key: 'sales.ticketTemplate',
      scope: 'sales',
      value: { a: 2 },
      version: 3,
    });
  });

  it('después de un upsert exitoso, la próxima usa version+1 si el server devolvió version', () => {
    rememberConfigRow({
      key: 'futbol.matchNotifications',
      scope: 'futbol',
      value: true,
      version: 1,
    });
    expect(buildUpsertPayload('futbol.matchNotifications', 'futbol', false).version).toBe(1);
  });

  it('version ausente o no numérica se trata como alta', () => {
    rememberConfigRows([
      { key: 'k', scope: 's', value: 1 },
      { key: 'k2', scope: 's', value: 1, version: Number.NaN },
    ]);
    expect(buildUpsertPayload('k', 's', 2).version).toBeUndefined();
    expect(buildUpsertPayload('k2', 's', 2).version).toBeUndefined();
  });
});
