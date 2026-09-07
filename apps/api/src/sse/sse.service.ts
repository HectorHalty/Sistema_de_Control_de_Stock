import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as PgClient } from 'pg';

interface SseClient {
  id: string;
  res: any; // Response object
  kitchenId?: string;
}

const CHANNEL = 'kitchen_events';

/**
 * Lightweight SSE (Server-Sent Events) service for real-time kitchen updates.
 * Clients connect via GET /sse/events and receive kitchen order changes.
 *
 * Cada instancia de la API sólo tiene sockets HTTP abiertos con SUS propios
 * clientes (`clients`, en memoria — eso no cambia, cada instancia siempre va
 * a necesitar su propio mapa de conexiones). Lo que sí cambiaba antes: un
 * evento emitido en la instancia A nunca llegaba a un cliente conectado a la
 * instancia B. Ahora `broadcastKitchenEvent` publica en un canal de Postgres
 * (`pg_notify`) y cada instancia, incluida la que lo emitió, lo recibe por
 * `LISTEN` y lo entrega a sus propios clientes — un solo camino de entrega,
 * sin duplicar el envío directo.
 */
@Injectable()
export class SseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);
  private clients = new Map<string, SseClient>();
  private listener: PgClient | null = null;
  /** true si LISTEN/NOTIFY está activo; si no, se cae a entrega solo local. */
  private crossInstanceReady = false;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('DATABASE_URL');
    if (!url) {
      this.logger.warn('DATABASE_URL no configurada: SSE queda limitado a esta instancia.');
      return;
    }
    const listener = new PgClient({ connectionString: url });
    try {
      await listener.connect();
      await listener.query(`LISTEN ${CHANNEL}`);
      listener.on('notification', (msg) => {
        if (msg.channel !== CHANNEL || !msg.payload) return;
        try {
          const { event, data, kitchenId } = JSON.parse(msg.payload);
          this.deliverLocally(event, data, kitchenId);
        } catch (err) {
          this.logger.warn(`Notificación SSE con payload inválido: ${err}`);
        }
      });
      listener.on('error', (err) => {
        this.logger.error(`Conexión LISTEN de SSE caída: ${err.message}`);
        this.crossInstanceReady = false;
      });
      this.listener = listener;
      this.crossInstanceReady = true;
    } catch (err) {
      this.logger.warn(
        `No se pudo abrir LISTEN/NOTIFY para SSE (${err instanceof Error ? err.message : err}). ` +
          'La API arranca igual, pero los eventos no se redistribuyen entre instancias.',
      );
    }
  }

  async onModuleDestroy() {
    if (this.listener) {
      await this.listener.end().catch(() => {});
    }
  }

  addClient(id: string, res: any, kitchenId?: string) {
    this.clients.set(id, { id, res, kitchenId });

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection event
    this.writeEvent(res, 'connected', { clientId: id });

    // Handle client disconnect
    res.on('close', () => {
      this.clients.delete(id);
    });
  }

  /**
   * Broadcast a kitchen order event to all connected clients, en todas las
   * instancias de la API. Si `LISTEN/NOTIFY` no está disponible (Postgres
   * caído, o `DATABASE_URL` ausente), cae a entrega solo local.
   */
  broadcastKitchenEvent(event: string, data: unknown, kitchenId?: string) {
    if (this.crossInstanceReady && this.listener) {
      const payload = JSON.stringify({ event, data, kitchenId });
      // pg_notify no acepta placeholders vía LISTEN client normal para el canal,
      // pero sí para el payload con una query parametrizada.
      this.listener.query('SELECT pg_notify($1, $2)', [CHANNEL, payload]).catch((err) => {
        this.logger.error(`No se pudo publicar evento SSE: ${err.message}`);
        // Fallback: al menos entregar localmente para no perder el evento.
        this.deliverLocally(event, data, kitchenId);
      });
      return;
    }
    this.deliverLocally(event, data, kitchenId);
  }

  private deliverLocally(event: string, data: unknown, kitchenId?: string) {
    for (const client of this.clients.values()) {
      // Filter by kitchen if specified
      if (kitchenId && client.kitchenId && client.kitchenId !== kitchenId) continue;

      this.writeEvent(client.res, event, data);
    }
  }

  private writeEvent(res: any, event: string, data: unknown) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
