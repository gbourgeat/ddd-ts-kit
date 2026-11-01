import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { OpenSearchRequest } from '../transport/open-search-transport';
import { InMemoryOpenSearch } from './in-memory-open-search';

const METHODS: readonly OpenSearchRequest['method'][] = ['GET', 'PUT', 'POST', 'DELETE'];

/** What the server answers instead of the node, for the specs of the transport. */
export type ServerMood = 'answering' | 'silent' | 'behind a proxy';

/**
 * The in-memory OpenSearch on a port of its own, so that the specs reach it through
 * `fetchTransport` as they reach a real node: the credentials of the security plugin checked on
 * every request (401 otherwise), and a mood for the cases a transport must survive.
 */
export class OpenSearchServer {
  static async start(credentials: { readonly username: string; readonly password: string }): Promise<OpenSearchServer> {
    const server = new OpenSearchServer(
      `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`,
    );

    await new Promise<void>((resolve) => server.http.listen(0, '127.0.0.1', resolve));

    return server;
  }

  readonly node = new InMemoryOpenSearch();

  mood: ServerMood = 'answering';

  private readonly http: Server;

  private readonly held = new Set<ServerResponse>();

  private constructor(private readonly authorization: string) {
    this.http = createServer((incoming, response) => {
      void this.answer(incoming, response);
    });
  }

  get url(): string {
    return `http://127.0.0.1:${String(Reflect.get(Object(this.http.address()), 'port'))}`;
  }

  async stop(): Promise<void> {
    for (const response of this.held) {
      response.destroy();
    }

    await new Promise<void>((resolve) => this.http.close(() => resolve()));
  }

  private async answer(incoming: IncomingMessage, response: ServerResponse): Promise<void> {
    const text = await bodyOf(incoming);

    if (this.mood === 'silent') {
      this.held.add(response);

      return;
    }

    if (this.mood === 'behind a proxy') {
      response.writeHead(502, { 'content-type': 'text/html' }).end('<html><body>Bad gateway</body></html>');

      return;
    }

    if (incoming.headers.authorization !== this.authorization) {
      response.writeHead(401, { 'content-type': 'application/json' });

      response.end(
        JSON.stringify({
          error: { type: 'security_exception', reason: 'missing authentication credentials' },
          status: 401,
        }),
      );

      return;
    }

    const url = new URL(incoming.url ?? '/', 'http://node');

    const answered = await this.node.request({
      method: methodOf(incoming.method),
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      ...(text === '' ? {} : { body: JSON.parse(text) }),
    });

    response.writeHead(answered.status, { 'content-type': 'application/json' }).end(JSON.stringify(answered.body));
  }
}

async function bodyOf(incoming: IncomingMessage): Promise<string> {
  let text = '';

  incoming.setEncoding('utf8');

  for await (const chunk of incoming) {
    text += String(chunk);
  }

  return text;
}

/** The method of a request, among those the store sends. */
function methodOf(written: string | undefined): OpenSearchRequest['method'] {
  return METHODS.find((method) => method === written) ?? 'GET';
}
