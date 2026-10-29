import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';
{{#if cache.rateLimit}}
import { getConnInfo } from '@hono/node-server/conninfo';
{{/if}}
import { Hono } from 'hono';
import { mountHono, problemErrorHandler } from '@ddd-ts-kit/http/hono';
{{#if rpc.orpc}}
import { orpcRouter } from '@ddd-ts-kit/http/orpc';
import { RPCHandler } from '@orpc/server/fetch';
{{/if}}
{{#if rpc.trpc}}
import { trpcRouter } from '@ddd-ts-kit/http/trpc';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
{{/if}}
import type { Application } from '{{alias.platform}}/composition/compose-application{{alias.ext}}';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
{{#if cache.rateLimit}}
import { tooManyRequestsFor } from '{{alias.platform}}/http/too-many-requests-for{{alias.ext}}';
{{/if}}
{{#if docs.any}}
import { withDocumentation } from '{{alias.platform}}/http/with-documentation{{alias.ext}}';
{{/if}}

export interface HttpServer {
  /** The port really bound: differs from the configured one when that was 0. */
  readonly port: number;

  close(): Promise<void>;
}

/** What the server needs of the application: its routes and what stands at its edge. */
type Served = Pick<Application, 'routes' | 'boundary' | 'logger'{{#if cache.rateLimit}} | 'rateLimiter' | 'ready'{{/if}}{{#if files.http}} | 'fileRoutes'{{/if}}>;

/**
 * Serves, in this order: the readiness probe and the limit of each caller (with a Redis protocol
 * server), the signed file links (with a storage the application serves), the routes of the
 * contexts, then the pages of the contract (with documentation on).{{#if rpc.orpc}} The same routes are served
 * as oRPC procedures under /rpc, for the typed client of the contract.{{/if}}{{#if rpc.trpc}} The same routes are served
 * as tRPC procedures under /trpc, for the typed client of the contract.{{/if}}
 */
export async function startHttpServer(served: Served, config: AppConfig): Promise<HttpServer> {
  const app = new Hono();

  // A failed middleware is answered as a problem, not as a text with the error written to stderr.
  app.onError(problemErrorHandler({ logger: served.logger }));

{{#if cache.rateLimit}}
  answerReadiness(app, served);
  limitEachCaller(app, served, config);
{{/if}}
{{#if files.http}}
  mountHono(app, served.fileRoutes, served.boundary);
{{/if}}
{{#unless rpc.none}}
  serveProcedures(app, served);
{{/unless}}
{{#if docs.any}}
  mountHono(app, withDocumentation(served.routes, config, served.boundary), served.boundary);
{{/if}}
{{#unless docs.any}}
  mountHono(app, served.routes, served.boundary);
{{/unless}}

  const server = await listen(app, config.port);

  return { port: boundPort(server), close: () => close(server) };
}
{{#if cache.rateLimit}}

/** Whether the Redis protocol server answers, for the load balancer; never limited, since it is polled. */
function answerReadiness(app: Hono, served: Served): void {
  app.get('/health/ready', async (context) => {
    const ready = await served.ready();

    return context.json({ status: ready ? 'up' : 'down' }, ready ? 200 : 503);
  });
}

/** One sliding window per caller address, before authentication costs anything. */
function limitEachCaller(app: Hono, served: Served, config: AppConfig): void {
  app.use(async (context, next) => {
    const forwardedFor = context.req.header('x-forwarded-for');
    const address = callerAddress(getConnInfo(context).remote.address, forwardedFor, config.trustProxy);
    const tooMany = await tooManyRequestsFor(served.rateLimiter, config.rateLimit, address);

    if (tooMany === undefined) {
      await next();

      return undefined;
    }

    return new Response(tooMany.body, { status: tooMany.status, headers: tooMany.headers });
  });
}

/**
 * The address of the socket, or, behind `hops` trusted proxies (TRUST_PROXY), the one the farthest
 * of them saw: X-Forwarded-For is read from the right, each proxy having added the one before it.
 */
function callerAddress(socket: string | undefined, forwardedFor: string | undefined, hops: number): string | undefined {
  const forwarded = (forwardedFor ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter((address) => address !== '');

  const chain = [socket, ...forwarded.reverse()];

  return chain[Math.min(hops, chain.length - 1)];
}
{{/if}}
{{#if rpc.orpc}}

const RPC_PREFIX = '/rpc';

/** Each route as the procedure named by its operationId: the same pipeline, the raw request what the routes read. */
function serveProcedures(app: Hono, served: Served): void {
  const handler = new RPCHandler(orpcRouter(served.routes, served.boundary));

  app.use(`${RPC_PREFIX}/*`, async (context, next) => {
    const headers = context.req.header();

    const { matched, response } = await handler.handle(context.req.raw, {
      prefix: RPC_PREFIX,
      context: { headers, raw: { headers, context } },
    });

    if (matched) {
      return context.newResponse(response.body, response);
    }

    await next();

    return undefined;
  });
}
{{/if}}
{{#if rpc.trpc}}

const TRPC_ENDPOINT = '/trpc';

/** Each route as the procedure named by its operationId: the same pipeline, the raw request what the routes read. */
function serveProcedures(app: Hono, served: Served): void {
  const router = trpcRouter(served.routes, served.boundary);

  app.all(`${TRPC_ENDPOINT}/*`, (context) => {
    const headers = context.req.header();

    return fetchRequestHandler({
      endpoint: TRPC_ENDPOINT,
      req: context.req.raw,
      router,
      createContext: () => ({ headers, raw: { headers, context } }),
    });
  });
}
{{/if}}

function listen(app: Hono, port: number): Promise<ServerType> {
  return new Promise<ServerType>((resolve) => {
    const server = serve({ fetch: app.fetch, port }, () => resolve(server));
  });
}

function boundPort(server: ServerType): number {
  const address: AddressInfo | string | null = server.address();

  return typeof address === 'object' && address !== null ? address.port : 0;
}

function close(server: ServerType): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}
