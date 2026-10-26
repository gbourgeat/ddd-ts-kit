import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { mountExpress } from '@ddd-ts-kit/http/express';
{{#if rpc.orpc}}
import { orpcRouter } from '@ddd-ts-kit/http/orpc';
import { RPCHandler } from '@orpc/server/node';
{{/if}}
{{#if rpc.trpc}}
import { trpcRouter } from '@ddd-ts-kit/http/trpc';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
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
type Served = Pick<Application, 'routes' | 'boundary'{{#if cache.rateLimit}} | 'rateLimiter' | 'ready'{{/if}}{{#if files.http}} | 'fileRoutes'{{/if}}>;

/**
 * Serves, in this order: the readiness probe and the limit of each caller (with a Redis protocol
 * server), the signed file links before any body parser (with a storage the application serves),
 * the routes of the contexts, then the pages of the contract (with documentation on).{{#if rpc.orpc}} The same
 * routes are served as oRPC procedures under /rpc, for the typed client of the contract.{{/if}}{{#if rpc.trpc}} The same
 * routes are served as tRPC procedures under /trpc, for the typed client of the contract.{{/if}}
 */
export async function startHttpServer(served: Served, config: AppConfig): Promise<HttpServer> {
  const app = express();

  app.disable('x-powered-by');
{{#if cache.rateLimit}}
  answerReadiness(app, served);
  limitEachCaller(app, served, config);
{{/if}}
{{#if files.http}}
  // Before the JSON parser, which would read first a JSON file sent through a signed link.
  mountExpress(app, served.fileRoutes, served.boundary);
{{/if}}
  // The bytes of a JSON body are kept for a controller that declares `rawBody` (a signed webhook).
  app.use(
    express.json({
      verify: (request, _response, bytes) => {
        Object.assign(request, { rawBody: bytes });
      },
    }),
  );
{{#unless rpc.none}}
  serveProcedures(app, served);
{{/unless}}
{{#if docs.any}}
  mountExpress(app, withDocumentation(served.routes, config, served.boundary), served.boundary);
{{/if}}
{{#unless docs.any}}
  mountExpress(app, served.routes, served.boundary);
{{/unless}}

  const server = await listen(app, config.port);

  return { port: boundPort(server), close: () => close(server) };
}
{{#if cache.rateLimit}}

/** Whether the Redis protocol server answers, for the load balancer; never limited, since it is polled. */
function answerReadiness(app: express.Express, served: Served): void {
  app.get(
    '/health/ready',
    (_request, response) =>
      void served.ready().then((ready) => response.status(ready ? 200 : 503).json({ status: ready ? 'up' : 'down' })),
  );
}

/** One sliding window per caller address, before authentication costs anything. */
function limitEachCaller(app: express.Express, served: Served, config: AppConfig): void {
  app.use((request, response, next) => {
    void tooManyRequestsFor(served.rateLimiter, config.rateLimit, request.ip).then((tooMany) => {
      if (tooMany === undefined) {
        next();
      } else {
        response.status(tooMany.status).set(tooMany.headers).send(tooMany.body);
      }
    }, next);
  });
}
{{/if}}
{{#if rpc.orpc}}

const RPC_PREFIX = '/rpc';

/** Each route as the procedure named by its operationId: the same pipeline, the JSON body already read. */
function serveProcedures(app: express.Express, served: Served): void {
  const handler = new RPCHandler(orpcRouter(served.routes, served.boundary));

  app.use(RPC_PREFIX, (request, response, next) => {
    const context = { headers: request.headers, raw: request };

    void handler.handle(request, response, { prefix: RPC_PREFIX, context }).then(({ matched }) => {
      if (!matched) {
        next();
      }
    }, next);
  });
}
{{/if}}
{{#if rpc.trpc}}

const TRPC_ENDPOINT = '/trpc';

/** Each route as the procedure named by its operationId: the same pipeline, the JSON body already read. */
function serveProcedures(app: express.Express, served: Served): void {
  app.use(
    TRPC_ENDPOINT,
    createExpressMiddleware({
      router: trpcRouter(served.routes, served.boundary),
      createContext: ({ req }) => ({ headers: req.headers, raw: req }),
    }),
  );
}
{{/if}}

function listen(app: express.Express, port: number): Promise<Server> {
  return new Promise<Server>((resolve) => {
    const server = app.listen(port, () => resolve(server));
  });
}

function boundPort(server: Server): number {
  const address: AddressInfo | string | null = server.address();

  return typeof address === 'object' && address !== null ? address.port : 0;
}

function close(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}
