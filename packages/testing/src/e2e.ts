import { AssertionError, deepStrictEqual } from 'node:assert';
import { setTimeout as sleep } from 'node:timers/promises';
import { inspect } from 'node:util';
import type { IntegrationEvent, IntegrationEventSubscriber, Subscription } from '@ddd-ts-kit/kernel';

export interface RunningServer {
  /** Where the application listens, without a trailing slash: `http://127.0.0.1:49152`. */
  readonly url: string;
  close(): Promise<void>;
}

export type HttpHeaders = Readonly<Record<string, string>>;

export interface TestServerOptions {
  /** Starts the whole application, real adapters included, on a free port. */
  start(): Promise<RunningServer>;
  /** Sent with every request of `client`, typically `authorization`. */
  readonly headers?: HttpHeaders;
}

export interface TestServer extends RunningServer {
  readonly client: HttpClient;
}

/**
 * Starts the application the way `start` says (any HTTP framework, any composition root) and
 * gives a JSON client bound to it. Close it in `afterAll`.
 */
export async function startTestServer(options: TestServerOptions): Promise<TestServer> {
  const server = await options.start();
  return {
    url: server.url,
    close: () => server.close(),
    client: createHttpClient(server.url, { headers: options.headers ?? {} }),
  };
}

/** The part of a Node `http.Server` that `listenOnRandomPort` uses. */
export interface NodeServer {
  listen(port: number, host: string, onListening: () => void): unknown;
  once(event: 'error', onError: (error: Error) => void): unknown;
  address(): { readonly port: number } | string | null;
  close(onClosed: (error?: Error) => void): unknown;
}

const LOOPBACK = '127.0.0.1';

/** For `start`, when the application is a Node server: `listenOnRandomPort(createServer(app))`. */
export function listenOnRandomPort(server: NodeServer): Promise<RunningServer> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK, () => resolve({ url: urlOf(server), close: () => closing(server) }));
  });
}

function urlOf(server: NodeServer): string {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new TypeError('The server does not listen on a TCP port');
  }
  return `http://${LOOPBACK}:${address.port}`;
}

function closing(server: NodeServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

export interface HttpResponse<Body = unknown> {
  readonly status: number;
  /** Names in lower case. */
  readonly headers: HttpHeaders;
  /** Parsed when the content type is JSON, the text otherwise, `undefined` when empty. */
  readonly body: Body;
}

export interface RequestOptions {
  /** Added to the default headers of the client; the same name replaces the default. */
  readonly headers?: HttpHeaders;
}

/**
 * A JSON client on the global `fetch`. It never throws on a status: a 4xx or 5xx answer is a
 * response to assert. `Body` is the caller's claim about what the API answers.
 */
export interface HttpClient {
  get<Body = unknown>(path: string, options?: RequestOptions): Promise<HttpResponse<Body>>;
  post<Body = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>>;
  put<Body = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>>;
  patch<Body = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>>;
  delete<Body = unknown>(path: string, options?: RequestOptions): Promise<HttpResponse<Body>>;
  /** A client sending these headers as well: another user, another tenant. */
  withHeaders(headers: HttpHeaders): HttpClient;
}

export function createHttpClient(baseUrl: string, defaults: RequestOptions = {}): HttpClient {
  return new FetchClient(baseUrl.replace(/\/+$/, ''), lowerCased(defaults.headers));
}

interface Exchange {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
  readonly options: RequestOptions | undefined;
}

class FetchClient implements HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly headers: HttpHeaders,
  ) {}

  get<Body>(path: string, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.#send({ method: 'GET', path, options });
  }

  post<Body>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.#send({ method: 'POST', path, body, options });
  }

  put<Body>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.#send({ method: 'PUT', path, body, options });
  }

  patch<Body>(path: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.#send({ method: 'PATCH', path, body, options });
  }

  delete<Body>(path: string, options?: RequestOptions): Promise<HttpResponse<Body>> {
    return this.#send({ method: 'DELETE', path, options });
  }

  withHeaders(headers: HttpHeaders): HttpClient {
    return new FetchClient(this.baseUrl, { ...this.headers, ...lowerCased(headers) });
  }

  async #send<Body>({ method, path, body, options }: Exchange): Promise<HttpResponse<Body>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...this.headers,
        ...lowerCased(options?.headers),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the body type is the caller's claim about the API under test; nothing here can check it
      body: (await readBody(response)) as Body,
    };
  }
}

// Header names are case-insensitive: without this, `Authorization` given per call would be
// sent next to the default `authorization` instead of replacing it.
function lowerCased(headers: HttpHeaders = {}): HttpHeaders {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  return isJson(response.headers.get('content-type')) ? JSON.parse(text) : text;
}

function isJson(contentType: string | null): boolean {
  return /[/+]json\b/i.test(contentType ?? '');
}

/**
 * Asserts the status and hands the response back. On a mismatch the failure shows the body,
 * which is where an API says why it refused: use it for every arrangement made through HTTP.
 */
export function expectStatus<Body>(response: HttpResponse<Body>, status: number): HttpResponse<Body> {
  if (response.status !== status) {
    throw new AssertionError({
      message: `Expected status ${status}, received ${response.status} with body ${inspect(response.body, { depth: 6 })}`,
      actual: response.status,
      expected: status,
      operator: 'strictEqual',
    });
  }
  return response;
}

export interface ExpectedProblem {
  readonly status: number;
  /** The stable error code, when the answer must carry this one. */
  readonly code?: string;
}

export type ProblemDetails = Readonly<Record<string, unknown>>;

const PROBLEM_JSON = 'application/problem+json';

/**
 * Asserts an RFC 9457 answer: the status, on the response and in the document, the
 * `application/problem+json` content type and the `code` member. Returns the document.
 */
export function expectProblem(response: HttpResponse, expected: ExpectedProblem): ProblemDetails {
  const problem = isRecord(response.body) ? response.body : {};
  const code = (value: unknown): object => (expected.code === undefined ? {} : { code: value });
  deepStrictEqual(
    {
      status: response.status,
      contentType: mediaTypeOf(response),
      problem: { status: problem.status, ...code(problem.code) },
    },
    {
      status: expected.status,
      contentType: PROBLEM_JSON,
      problem: { status: expected.status, ...code(expected.code) },
    },
  );
  return problem;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mediaTypeOf(response: HttpResponse): string | undefined {
  return response.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
}

export interface EventuallyOptions {
  /** Default 2000. */
  readonly timeoutMs?: number;
  /** Default 20. */
  readonly intervalMs?: number;
}

/**
 * Runs the assertion again until it passes, and returns what it returned. For outcomes that
 * are eventually consistent: integration events, projections. When the time is up, the
 * failure quotes the last error and carries it as `cause`.
 */
export async function eventually<T>(
  assertion: () => T | Promise<T>,
  options: EventuallyOptions = {},
): Promise<T> {
  const { timeoutMs = 2000, intervalMs = 20 } = options;
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (performance.now() + intervalMs > deadline) throw stillFailing(error, timeoutMs);
    }
    await sleep(intervalMs);
  }
}

function stillFailing(error: unknown, timeoutMs: number): Error {
  const last = error instanceof Error ? error.message : inspect(error);
  return new Error(`Still failing after ${timeoutMs} ms: ${last}`, { cause: error });
}

/** An event type, or anything carrying one, such as a `defineIntegrationEvent` declaration. */
export type EventType = string | { readonly type: string };

export interface EventRecorder {
  /** The events received so far, in order, optionally of one type. */
  received<Payload = unknown>(type?: EventType): IntegrationEvent<Payload>[];
  /** Resolves with the first event of the type that satisfies the predicate, received or to come. */
  waitFor<Payload = unknown>(
    type: EventType,
    predicate?: (event: IntegrationEvent<Payload>) => boolean,
    options?: EventuallyOptions,
  ): Promise<IntegrationEvent<Payload>>;
  /** Unsubscribes. What was received stays readable. */
  stop(): void;
}

/**
 * Subscribes to the given types and records what is published, to assert integration events
 * from the outside, as another context would see them.
 */
export function collectEvents(
  subscriber: IntegrationEventSubscriber,
  types: readonly EventType[],
): EventRecorder {
  return new SubscribedRecorder(subscriber, types.map(nameOf));
}

class SubscribedRecorder implements EventRecorder {
  readonly #events: IntegrationEvent[] = [];
  readonly #subscriptions: Subscription[];

  constructor(
    subscriber: IntegrationEventSubscriber,
    private readonly types: readonly string[],
  ) {
    this.#subscriptions = types.map((type) =>
      subscriber.subscribe(type, async (event) => void this.#events.push(event)),
    );
  }

  received<Payload = unknown>(type?: EventType): IntegrationEvent<Payload>[] {
    const events = this.#events.filter((event) => type === undefined || event.type === nameOf(type));
    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the payload type is the caller's claim about what the application published; nothing here can check it
    return events as IntegrationEvent<Payload>[];
  }

  waitFor<Payload = unknown>(
    type: EventType,
    predicate: (event: IntegrationEvent<Payload>) => boolean = () => true,
    options?: EventuallyOptions,
  ): Promise<IntegrationEvent<Payload>> {
    this.#assertCollected(nameOf(type));
    return eventually(() => this.#firstMatch(nameOf(type), predicate), options);
  }

  stop(): void {
    for (const subscription of this.#subscriptions.splice(0)) subscription.unsubscribe();
  }

  #assertCollected(type: string): void {
    if (!this.types.includes(type)) {
      throw new TypeError(`"${type}" is not collected: add it to the types given to collectEvents`);
    }
  }

  #firstMatch<Payload>(
    type: string,
    predicate: (event: IntegrationEvent<Payload>) => boolean,
  ): IntegrationEvent<Payload> {
    const candidates = this.received<Payload>(type);
    const match = candidates.find(predicate);
    if (match === undefined) {
      throw new AssertionError({
        message: `No "${type}" event matched; ${candidates.length} of that type received`,
      });
    }
    return match;
  }
}

function nameOf(type: EventType): string {
  return typeof type === 'string' ? type : type.type;
}

/**
 * How an end-to-end suite empties the database between tests. A contract only: the
 * implementation belongs to the project and its driver (see the README for PostgreSQL).
 */
export interface DatabaseReset {
  reset(): Promise<void>;
}
