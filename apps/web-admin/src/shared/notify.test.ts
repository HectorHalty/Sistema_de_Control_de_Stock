import { describe, it, expect, vi } from 'vitest';
import { notifyError, subscribeToErrors } from './notify';

describe('notify (pub/sub de errores globales)', () => {
  it('entrega el mensaje a los suscriptores activos', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToErrors(listener);

    notifyError('algo falló');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ message: 'algo falló' }));
    unsubscribe();
  });

  it('no entrega nada a un suscriptor que se dio de baja', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToErrors(listener);
    unsubscribe();

    notifyError('no debería llegar');

    expect(listener).not.toHaveBeenCalled();
  });

  it('cada evento tiene un id distinto', () => {
    const events: number[] = [];
    const unsubscribe = subscribeToErrors((e) => events.push(e.id));

    notifyError('uno');
    notifyError('dos');

    expect(events[0]).not.toBe(events[1]);
    unsubscribe();
  });

  it('múltiples suscriptores reciben el mismo evento', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeToErrors(a);
    const unsubB = subscribeToErrors(b);

    notifyError('para todos');

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubA();
    unsubB();
  });
});
