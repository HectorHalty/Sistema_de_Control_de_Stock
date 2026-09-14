import { describe, expect, it, vi } from 'vitest';
import { emptyToNull, emptyToNullInt, operatorFields, optionalUuid, scheduleBackgroundHydrate } from './persist-mutation';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('optionalUuid', () => {
  it('omite Admin y otros ids locales', () => {
    expect(optionalUuid('Admin')).toBeUndefined();
    expect(optionalUuid('PED-001')).toBeUndefined();
    expect(optionalUuid('')).toBeUndefined();
    expect(optionalUuid(undefined)).toBeUndefined();
  });

  it('deja pasar un UUID de servidor', () => {
    expect(optionalUuid(UUID)).toBe(UUID);
  });
});

describe('operatorFields', () => {
  it('no incluye operatorId si no es UUID (evita 400 del ValidationPipe)', () => {
    expect(operatorFields({ operatorId: 'Admin', operatorName: 'Admin' })).toEqual({
      operatorName: 'Admin',
    });
  });

  it('incluye operatorId UUID', () => {
    expect(operatorFields({ operatorId: UUID, operatorName: 'admin' })).toEqual({
      operatorId: UUID,
      operatorName: 'admin',
    });
  });
});

describe('emptyToNull', () => {
  it('convierte vacío a null para limpiar columnas', () => {
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull('  ')).toBeNull();
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull('pack')).toBe('pack');
    expect(emptyToNull(undefined)).toBeUndefined();
  });
});

describe('emptyToNullInt', () => {
  it('limpia orderUnit <= 0', () => {
    expect(emptyToNullInt(0)).toBeNull();
    expect(emptyToNullInt(undefined)).toBeUndefined();
    expect(emptyToNullInt(12)).toBe(12);
  });
});

describe('scheduleBackgroundHydrate', () => {
  it('no espera la tarea: el caller sigue de inmediato', async () => {
    let started = false;
    let finished = false;
    scheduleBackgroundHydrate(async () => {
      started = true;
      await Promise.resolve();
      finished = true;
    });
    expect(started).toBe(true);
    expect(finished).toBe(false);
    await vi.waitFor(() => expect(finished).toBe(true));
  });

  it('invoca onError si la hidratación falla', async () => {
    const onError = vi.fn();
    scheduleBackgroundHydrate(async () => {
      throw new Error('hydrate failed');
    }, onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
