import { type Server, type Socket, createServer } from 'node:net';
import { ClientSession, type Router } from './client-session';
import type { ClientFrame } from './frames';
import { statusHeaders } from './headers';
import { JetStream } from './jetstream';
import type { Outbox } from './outbox';

/**
 * A NATS server with JetStream, in the process of the test and on a port of its own, so that the
 * suites of the bus run in the unit run too, through the real client and its real TCP transport.
 * It keeps the core protocol (subscriptions, requests and their replies, no responders) and what
 * the bus asks of JetStream: limits streams with a duplicate window, durable pull consumers with
 * explicit acknowledgement, `ack_wait`, `max_deliver`, a delayed `-NAK`, `+TERM`, direct gets.
 * Not kept: queue groups, clustering, push consumers, key-value and object stores, accounts.
 */
export class InMemoryNats implements Router, Outbox {
  private readonly sessions = new Set<ClientSession>();

  private readonly jetstream = new JetStream(this);

  private clients = 0;

  private constructor(private readonly server: Server) {
    server.on('connection', (socket) => {
      this.join(socket);
    });
  }

  static async start(): Promise<InMemoryNats> {
    const server = createServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    return new InMemoryNats(server);
  }

  get port(): number {
    const address = this.server.address();

    return typeof address === 'object' && address !== null ? address.port : 0;
  }

  get url(): string {
    return `nats://127.0.0.1:${String(this.port)}`;
  }

  publish({ subject, reply, headers, data }: Extract<ClientFrame, { op: 'PUB' }>): void {
    if (subject.startsWith('$JS.API.')) {
      if (reply !== undefined) {
        this.jetstream.request(subject, data, reply);
      }

      return;
    }

    if (subject.startsWith('$JS.ACK.')) {
      this.jetstream.acknowledge(subject, data);

      if (reply !== undefined) {
        this.deliver(reply, reply, undefined, undefined, Buffer.alloc(0));
      }

      return;
    }

    const stored = this.jetstream.store(subject, headers, data);
    const delivered = this.deliver(subject, subject, reply, headers, data);

    if (reply === undefined) {
      return;
    }

    if (stored !== undefined) {
      const { stream, seq, duplicate } = stored;
      const ack = duplicate ? { stream, seq, duplicate } : { stream, seq };

      this.deliver(reply, reply, undefined, undefined, Buffer.from(JSON.stringify(ack)));
    } else if (delivered === 0) {
      this.deliver(reply, reply, undefined, statusHeaders(503, ''), Buffer.alloc(0));
    }
  }

  deliver(
    target: string,
    subject: string,
    reply: string | undefined,
    headers: Buffer | undefined,
    data: Buffer,
  ): number {
    let delivered = 0;

    for (const session of this.sessions) {
      delivered += session.deliver(target, subject, reply, headers, data);
    }

    return delivered;
  }

  refusePullsOf(stream: string, consumer: string): void {
    this.jetstream.refusePullsOf(stream, consumer);
  }

  listens(target: string): boolean {
    return [...this.sessions].some((session) => session.listens(target));
  }

  left(session: ClientSession): void {
    this.sessions.delete(session);
  }

  /** Disconnects every client and stops listening. What the streams held is gone with it. */
  async close(): Promise<void> {
    this.jetstream.stop();

    for (const session of this.sessions) {
      session.close();
    }

    await new Promise((resolve) => {
      this.server.close(resolve);
    });
  }

  private join(socket: Socket): void {
    this.clients += 1;
    this.sessions.add(new ClientSession(socket, this, this.clients));
  }
}
