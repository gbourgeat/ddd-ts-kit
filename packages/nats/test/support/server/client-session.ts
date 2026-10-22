import type { Socket } from 'node:net';
import { type ClientFrame, FrameReader, messageFrame } from './frames';
import { subjectMatches } from './subjects';

/** What a client session needs of the server it is connected to. */
export interface Router {
  readonly port: number;
  publish(frame: Extract<ClientFrame, { op: 'PUB' }>): void;
  left(session: ClientSession): void;
}

interface Interest {
  readonly subject: string;
  /** Messages left before the subscription ends by itself, from `UNSUB <sid> <max>`. */
  remaining: number | undefined;
}

/** One TCP client: its subscriptions, and what the server writes to it. */
export class ClientSession {
  private readonly reader = new FrameReader();

  private readonly interests = new Map<string, Interest>();

  constructor(
    private readonly socket: Socket,
    private readonly router: Router,
    id: number,
  ) {
    socket.on('data', (chunk) => {
      this.received(chunk);
    });

    socket.on('error', () => undefined);

    socket.on('close', () => {
      this.interests.clear();
      router.left(this);
    });

    this.write(Buffer.from(`INFO ${JSON.stringify(infoOf(id, router.port))}\r\n`));
  }

  /** Writes a message routed to `target` to every matching subscription; returns how many got it. */
  deliver(
    target: string,
    subject: string,
    reply: string | undefined,
    headers: Buffer | undefined,
    data: Buffer,
  ): number {
    let delivered = 0;

    for (const [sid, interest] of [...this.interests]) {
      if (subjectMatches(interest.subject, target)) {
        this.write(messageFrame(subject, sid, reply, headers, data));
        delivered += 1;
        this.spend(sid, interest);
      }
    }

    return delivered;
  }

  listens(target: string): boolean {
    return [...this.interests.values()].some((interest) => subjectMatches(interest.subject, target));
  }

  close(): void {
    this.socket.destroy();
  }

  private received(chunk: Buffer): void {
    for (const frame of this.reader.read(chunk)) {
      this.handle(frame);
    }
  }

  private handle(frame: ClientFrame): void {
    switch (frame.op) {
      case 'PING':
        this.write(Buffer.from('PONG\r\n'));
        break;
      case 'SUB':
        this.interests.set(frame.sid, { subject: frame.subject, remaining: undefined });
        break;
      case 'UNSUB':
        this.unsubscribe(frame.sid, frame.max);
        break;
      case 'PUB':
        this.router.publish(frame);
        break;
      default:
        break;
    }
  }

  private unsubscribe(sid: string, max: number | undefined): void {
    const interest = this.interests.get(sid);

    if (max === undefined || interest === undefined) {
      this.interests.delete(sid);
    } else {
      interest.remaining = max;
    }
  }

  private spend(sid: string, interest: Interest): void {
    if (interest.remaining === undefined) {
      return;
    }

    interest.remaining -= 1;

    if (interest.remaining <= 0) {
      this.interests.delete(sid);
    }
  }

  private write(bytes: Buffer): void {
    if (this.socket.writable) {
      this.socket.write(bytes);
    }
  }
}

/** The INFO of nats-server 2.15, the version whose API paths the client then takes. */
function infoOf(id: number, port: number) {
  return {
    server_id: 'IN-MEMORY',
    server_name: 'in-memory',
    version: '2.15.0',
    proto: 1,
    go: 'none',
    host: '127.0.0.1',
    port,
    headers: true,
    max_payload: 1_048_576,
    jetstream: true,
    client_id: id,
    api_lvl: 5,
  };
}
