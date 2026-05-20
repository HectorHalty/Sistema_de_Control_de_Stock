import { Injectable } from '@nestjs/common';

interface SseClient {
  id: string;
  res: any; // Response object
  kitchenId?: string;
}

/**
 * Lightweight SSE (Server-Sent Events) service for real-time kitchen updates.
 * Clients connect via GET /sse/events and receive kitchen order changes.
 */
@Injectable()
export class SseService {
  private clients = new Map<string, SseClient>();

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
   * Broadcast a kitchen order event to all connected clients.
   * If kitchenId is specified, only clients filtering for that kitchen receive it.
   */
  broadcastKitchenEvent(event: string, data: unknown, kitchenId?: string) {
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });

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
