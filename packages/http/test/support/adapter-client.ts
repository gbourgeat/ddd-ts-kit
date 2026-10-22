import { afterAll, beforeAll } from 'vitest';
import { UnauthorizedError, createErrorMapper, type ErrorContext } from '../../src';
import { orderRoutes } from './orders';
import { executionScope, readExecution } from './read-execution';
import type { ReadAuthorization, RunningServer, StartServer } from './running-server';

export interface AdapterClient {
  /** What the error hook of the server was told, in order. */
  readonly reported: { error: unknown; context: ErrorContext }[];
  call(path: string, init?: RequestInit): Promise<Response>;
  post(body: unknown): Promise<Response>;
}

/** Starts the order routes on the adapter for the enclosing suite and gives a client for them. */
export function adapterClient(start: StartServer, readAuthorization: ReadAuthorization): AdapterClient {
  let server: RunningServer;
  const reported: AdapterClient['reported'] = [];

  beforeAll(async () => {
    server = await start([...orderRoutes, readExecution], {
      errorMapper: createErrorMapper({ ORDER_ALREADY_SHIPPED: 410 }),
      validateResponses: true,
      executionScope,
      onError: (error, context) => reported.push({ error, context }),
      resolvePrincipal: (raw) => {
        const authorization = readAuthorization(raw);

        if (authorization === 'Bearer expired') {
          throw new UnauthorizedError('The token has expired.');
        }

        return authorization === undefined ? undefined : { subject: authorization };
      },
    });
  });

  afterAll(async () => {
    await server.close();
  });

  const call = (path: string, init?: RequestInit): Promise<Response> => fetch(`${server.url}${path}`, init);

  const post = (body: unknown): Promise<Response> =>
    call('/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  return { reported, call, post };
}
