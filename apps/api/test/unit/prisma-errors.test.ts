import { describe, it, expect } from 'vitest';
import {
  isPrismaUniqueConflict,
  isPrismaForeignKeyViolation,
  isPrismaRecordNotFound,
} from '../../src/common/prisma-errors';

describe('prisma-errors', () => {
  it('reconoce P2002 como conflicto de unicidad', () => {
    expect(isPrismaUniqueConflict({ code: 'P2002' })).toBe(true);
    expect(isPrismaUniqueConflict({ code: 'P2003' })).toBe(false);
  });

  it('reconoce P2003 como violación de clave foránea', () => {
    expect(isPrismaForeignKeyViolation({ code: 'P2003' })).toBe(true);
    expect(isPrismaForeignKeyViolation({ code: 'P2002' })).toBe(false);
  });

  it('reconoce P2025 como registro no encontrado', () => {
    expect(isPrismaRecordNotFound({ code: 'P2025' })).toBe(true);
    expect(isPrismaRecordNotFound({ code: 'P2002' })).toBe(false);
  });

  it('no explota con valores que no son objetos', () => {
    for (const value of [null, undefined, 'P2002', 42]) {
      expect(isPrismaUniqueConflict(value)).toBe(false);
      expect(isPrismaForeignKeyViolation(value)).toBe(false);
      expect(isPrismaRecordNotFound(value)).toBe(false);
    }
  });
});
