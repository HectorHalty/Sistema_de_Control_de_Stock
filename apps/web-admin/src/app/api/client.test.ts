import { describe, expect, it } from 'vitest';
import { formatApiErrorMessage, getApiErrorMessage } from '@/app/api/client';

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

  it('traduce stock insuficiente con mensaje anidado de Nest', () => {
    const msg = formatApiErrorMessage(409, {
      message: {
        message: 'Insufficient stock for checkout',
        missing: [{ stockProductId: 'a', required: 3, available: 0 }],
      },
    });
    expect(msg).toContain('Stock insuficiente');
    expect(msg).toContain('faltan 3');
  });

  it('traduce rate limit', () => {
    const msg = formatApiErrorMessage(429, {
      message: 'Too many requests, please try again later',
    });
    expect(msg).toContain('Demasiadas solicitudes');
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

describe('getApiErrorMessage', () => {
  it('lee ApiError por duck-typing cuando instanceof falla entre chunks', () => {
    const msg = getApiErrorMessage(
      { name: 'ApiError', message: 'Stock insuficiente', status: 409 },
      'fallback',
    );
    expect(msg).toBe('Stock insuficiente');
  });

  it('usa el mensaje de Error genérico', () => {
    expect(getApiErrorMessage(new TypeError('Network failed'), 'fallback')).toBe('Network failed');
  });
});
