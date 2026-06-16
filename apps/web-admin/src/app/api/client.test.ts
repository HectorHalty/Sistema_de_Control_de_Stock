import { describe, expect, it } from 'vitest';
import { formatApiErrorMessage } from '@/app/api/client';

describe('formatApiErrorMessage', () => {
  it('traduce stock insuficiente con detalle', () => {
    const msg = formatApiErrorMessage(409, {
      message: 'Insufficient stock for checkout',
      missing: [{ stockProductId: 'a', required: 5, available: 1 }],
    });
    expect(msg).toContain('Stock insuficiente');
    expect(msg).toContain('faltan 5');
    expect(msg).toContain('hay 1');
  });

  it('traduce operatorId inválido', () => {
    const msg = formatApiErrorMessage(400, {
      message: ['operatorId must be a UUID'],
    });
    expect(msg).toContain('Sesión inválida');
  });

  it('traduce salesProductId inválido', () => {
    const msg = formatApiErrorMessage(400, {
      message: ['items.0.salesProductId must be a UUID'],
    });
    expect(msg).toContain('no sincronizados');
  });
});
