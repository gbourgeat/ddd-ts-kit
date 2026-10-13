import { createServer, type IncomingMessage, type Server } from 'node:http';

/**
 * The purge API of a CDN as its documentation describes it, over the answers it keeps: Fastly
 * (`POST /service/<id>/purge`, `Fastly-Key`, at most 256 `surrogate_keys`, compared as written)
 * and Cloudflare (`POST /zones/<zone>/purge_cache`, a bearer token, at most 100 `tags`, compared
 * without case). A purge removes every answer filed under one of the tags it names.
 */
export interface FakeCdnApi {
  readonly url: string;
  store(key: string, tags: readonly string[]): void;
  holds(key: string): boolean;
  close(): Promise<void>;
}

interface Dialect {
  readonly path: RegExp;
  readonly authorized: (request: IncomingMessage) => boolean;
  readonly tagsOf: (body: unknown) => unknown;
  readonly bound: number;
  readonly sameTag: (filed: string, named: string) => boolean;
}

const TOKEN = 'the-token';

export const FASTLY: Dialect = {
  path: /^\/service\/svc-1\/purge$/,
  authorized: (request) => request.headers['fastly-key'] === TOKEN,
  tagsOf: (body) => fieldOf(body, 'surrogate_keys'),
  bound: 256,
  sameTag: (filed, named) => filed === named,
};

export const CLOUDFLARE: Dialect = {
  path: /^\/zones\/zone-1\/purge_cache$/,
  authorized: (request) => request.headers.authorization === `Bearer ${TOKEN}`,
  tagsOf: (body) => fieldOf(body, 'tags'),
  bound: 100,
  sameTag: (filed, named) => filed.toLowerCase() === named.toLowerCase(),
};

export const CDN_TOKEN = TOKEN;

export async function startFakeCdnApi(dialect: Dialect): Promise<FakeCdnApi> {
  const filed = new Map<string, readonly string[]>();

  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => chunks.push(chunk));

    request.on('end', () => {
      const status = purged(dialect, request, Buffer.concat(chunks).toString('utf8'), filed);

      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ success: status === 200 }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    store: (key, tags) => filed.set(key, tags),
    holds: (key) => filed.has(key),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** The status of one purge request, after removing what it names. */
function purged(
  dialect: Dialect,
  request: IncomingMessage,
  body: string,
  filed: Map<string, readonly string[]>,
): number {
  if (request.method !== 'POST' || !dialect.path.test(request.url ?? '')) {
    return 404;
  }

  if (!dialect.authorized(request)) {
    return 401;
  }

  const named = dialect.tagsOf(parsed(body));

  if (!isTagList(named) || named.length === 0 || named.length > dialect.bound) {
    return 400;
  }

  for (const [key, tags] of filed) {
    if (tags.some((tag) => named.some((name) => dialect.sameTag(tag, name)))) {
      filed.delete(key);
    }
  }

  return 200;
}

function parsed(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function fieldOf(body: unknown, field: string): unknown {
  return typeof body === 'object' && body !== null ? Reflect.get(body, field) : undefined;
}

function isTagList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((tag) => typeof tag === 'string');
}
