import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'node:zlib';

export interface ReceivedEvent {
  readonly [field: string]: unknown;
  readonly tags?: Record<string, string>;
  readonly fingerprint?: string[];
  readonly level?: string;
  readonly user?: Record<string, unknown>;
  readonly breadcrumbs?: unknown[];
  readonly request?: Record<string, unknown>;
  readonly contexts?: {
    readonly trace?: { readonly trace_id?: string; readonly span_id?: string };
    readonly [name: string]: unknown;
  };
  readonly exception?: {
    readonly values?: {
      readonly type?: string;
      readonly value?: string;
      readonly stacktrace?: { readonly frames?: Record<string, unknown>[] };
    }[];
  };
}

interface EnvelopeItem {
  readonly type: string;
  readonly payload: unknown;
}

/**
 * An ingestion endpoint speaking the Sentry envelope protocol, on a port of the loopback
 * interface: what the SDK really sends, read back as data. Nothing leaves the machine.
 */
export class EnvelopeServer {
  /** The item types of every envelope received, in order: `event`, `transaction`, `session`... */
  readonly itemTypes: string[] = [];

  readonly events: ReceivedEvent[] = [];

  private constructor(private readonly server: Server) {}

  static async listening(): Promise<EnvelopeServer> {
    const server = createServer();
    const endpoint = new EnvelopeServer(server);

    server.on('request', (request, response) => {
      void bodyOf(request).then((body) => {
        endpoint.receive(body);
        response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    return endpoint;
  }

  get dsn(): string {
    return `http://publickey@127.0.0.1:${this.port}/1`;
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private get port(): number {
    const address = this.server.address();

    return isAddressInfo(address) ? address.port : 0;
  }

  private receive(body: string): void {
    for (const item of itemsOf(body)) {
      this.itemTypes.push(item.type);

      if (item.type === 'event' && isRecord(item.payload)) {
        this.events.push(item.payload);
      }
    }
  }
}

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    }
  }

  const raw = Buffer.concat(chunks);

  return (request.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw).toString('utf8');
}

/** An envelope is a header line, then for each item a header line and a payload line. */
function itemsOf(body: string): EnvelopeItem[] {
  const [, ...lines] = body.split('\n');
  const items: EnvelopeItem[] = [];

  for (let index = 0; index + 1 < lines.length; index += 2) {
    const header: unknown = JSON.parse(lines[index] ?? '{}');
    const payload: unknown = JSON.parse(lines[index + 1] ?? 'null');

    if (isRecord(header) && typeof header['type'] === 'string') {
      items.push({ type: header['type'], payload });
    }
  }

  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAddressInfo(address: string | AddressInfo | null): address is AddressInfo {
  return typeof address === 'object' && address !== null;
}
