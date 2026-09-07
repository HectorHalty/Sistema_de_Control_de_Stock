import { describe, it, expect, afterEach } from 'vitest';
import { SseService } from '../../src/sse/sse.service';
import { TEST_DATABASE_URL } from './helpers/db';

/** ConfigService mínimo — sólo lo que SseService lee (`DATABASE_URL`). */
class FakeConfigService {
  get<T = string>(key: string): T | undefined {
    if (key === 'DATABASE_URL') return TEST_DATABASE_URL as unknown as T;
    return undefined;
  }
}

/** Response fake que junta lo que la instancia le escribe, para asserts. */
function fakeResponse() {
  const chunks: string[] = [];
  const listeners: Record<string, () => void> = {};
  return {
    writeHead: () => {},
    write: (chunk: string) => chunks.push(chunk),
    on: (evt: string, cb: () => void) => {
      listeners[evt] = cb;
    },
    chunks,
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout esperando el evento SSE');
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe('SSE de cocina redistribuido entre instancias (Postgres LISTEN/NOTIFY)', () => {
  const services: SseService[] = [];

  afterEach(async () => {
    while (services.length) {
      await services.pop()!.onModuleDestroy();
    }
  });

  it('un evento emitido en la instancia A llega a un cliente conectado en la instancia B', async () => {
    const instanciaA = new SseService(new FakeConfigService() as any);
    const instanciaB = new SseService(new FakeConfigService() as any);
    services.push(instanciaA, instanciaB);

    await instanciaA.onModuleInit();
    await instanciaB.onModuleInit();

    const resB = fakeResponse();
    instanciaB.addClient('cliente-b', resB, 'cocina-1');

    instanciaA.broadcastKitchenEvent(
      'kitchen-order-updated',
      { orderId: 'orden-1', status: 'preparing' },
      'cocina-1',
    );

    await waitFor(() => resB.chunks.some((c) => c.includes('orden-1')));

    const payload = resB.chunks.join('');
    expect(payload).toContain('event: kitchen-order-updated');
    expect(payload).toContain('orden-1');
  });

  it('respeta el filtro por cocina también entre instancias', async () => {
    const instanciaA = new SseService(new FakeConfigService() as any);
    const instanciaB = new SseService(new FakeConfigService() as any);
    services.push(instanciaA, instanciaB);

    await instanciaA.onModuleInit();
    await instanciaB.onModuleInit();

    const resB = fakeResponse();
    instanciaB.addClient('cliente-b', resB, 'cocina-2'); // escucha otra cocina

    instanciaA.broadcastKitchenEvent(
      'kitchen-order-updated',
      { orderId: 'orden-2', status: 'preparing' },
      'cocina-1',
    );

    // Da tiempo a que el NOTIFY viaje; no debería llegarle nada a resB.
    await new Promise((r) => setTimeout(r, 500));
    expect(resB.chunks.some((c) => c.includes('orden-2'))).toBe(false);
  });
});
