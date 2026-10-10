import { createHttpClient } from './create-http-client.js';
import type { HttpClient } from './http-client.js';
import type { HttpHeaders } from './http-headers.js';
import type { RunningServer } from './running-server.js';

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
