import 'reflect-metadata';
import { {{#if rpc.orpc}}type IncomingMessage, {{/if}}{{#if rpc.trpc}}type RequestListener, {{/if}}Server{{#if rpc.orpc}}, type ServerResponse{{/if}} } from 'node:http';
import { NestFactory } from '@nestjs/core';
{{#if rpc.orpc}}
import { orpcRouter } from '@ddd-ts-kit/http/orpc';
import { RPCHandler } from '@orpc/server/node';
{{/if}}
{{#if rpc.trpc}}
import { trpcRouter } from '@ddd-ts-kit/http/trpc';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
{{/if}}
import type { Application } from '{{alias.platform}}/composition/compose-application{{alias.ext}}';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { createAppModule } from '{{alias.platform}}/http/create-app-module{{alias.ext}}';
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
type Served = Pick<Application, 'routes' | 'boundary'{{#if routes.nest}} | 'controllers'{{/if}}{{#if cache.rateLimit}} | 'rateLimiter' | 'ready'{{/if}}{{#if files.http}} | 'fileRoutes'{{/if}}>;
{{#if cache.rateLimit}}

/** The part of the incoming request and of its response the limiter and the probe need, whatever Nest runs on. */
interface Incoming {
  readonly url?: string;
  readonly socket: { readonly remoteAddress?: string };
}

interface Outgoing {
  writeHead(status: number, headers: Readonly<Record<string, string>>): Outgoing;

  end(body: string): void;
}

type Middleware = (request: Incoming, response: Outgoing, next: () => void) => void;
{{/if}}

/**
 * Serves, in this order: the readiness probe and the limit of each caller (with a Redis protocol
 * server), then the routes of the contexts, the pages of the contract (with documentation on) and
 * the signed file links (with a storage the application serves), all in one Nest module.{{#if rpc.orpc}} The
 * routes of the contexts are served as oRPC procedures under /rpc too, for the typed client of the contract.{{/if}}{{#if rpc.trpc}} The
 * routes of the contexts are served as tRPC procedures under /trpc too, for the typed client of the contract.{{/if}}
 */
export async function startHttpServer(served: Served, config: AppConfig): Promise<HttpServer> {
{{#if files.http}}
{{#if docs.any}}
  const routes = [...withDocumentation(served.routes, config, served.boundary), ...served.fileRoutes];
{{/if}}
{{#unless docs.any}}
  const routes = [...served.routes, ...served.fileRoutes];
{{/unless}}
{{/if}}
{{#unless files.http}}
{{#if docs.any}}
  const routes = withDocumentation(served.routes, config, served.boundary);
{{/if}}
{{#unless docs.any}}
  const routes = served.routes;
{{/unless}}
{{/unless}}

{{#if routes.nest}}
  const app = await NestFactory.create(createAppModule(routes, served.boundary, served.controllers), {
    logger: ['error', 'warn'],
    // Keeps the bytes of the body for a controller that declares `rawBody` (a signed webhook).
    rawBody: true,
  });
{{/if}}
{{#unless routes.nest}}
  const app = await NestFactory.create(createAppModule(routes, served.boundary), {
    logger: ['error', 'warn'],
    rawBody: true,
  });
{{/unless}}

{{#if cache.rateLimit}}
  app.use(answeringReadiness(served));
  app.use(limitingEachCaller(served, config));

{{/if}}
{{#if rpc.orpc}}
  app.use(RPC_PREFIX, servingProcedures(served));

{{/if}}
{{#if rpc.trpc}}
  app.use(TRPC_ENDPOINT, servingProcedures(served));

{{/if}}
  await app.listen(config.port);

  return { port: boundPort(app.getHttpServer()), close: () => app.close() };
}
{{#if cache.rateLimit}}

/** Whether the Redis protocol server answers, for the load balancer; never limited, since it is polled. */
function answeringReadiness(served: Served): Middleware {
  return (request, response, next) => {
    if (request.url !== '/health/ready') {
      next();

      return;
    }

    void served.ready().then((ready) => {
      response
        .writeHead(ready ? 200 : 503, { 'content-type': 'application/json' })
        .end(JSON.stringify({ status: ready ? 'up' : 'down' }));
    });
  };
}

/** One sliding window per caller address, before authentication costs anything. */
function limitingEachCaller(served: Served, config: AppConfig): Middleware {
  return (request, response, next) => {
    void tooManyRequestsFor(served.rateLimiter, config.rateLimit, request.socket.remoteAddress).then((tooMany) => {
      if (tooMany === undefined) {
        next();
      } else {
        response.writeHead(tooMany.status, tooMany.headers).end(tooMany.body);
      }
    });
  };
}
{{/if}}
{{#if rpc.orpc}}

const RPC_PREFIX = '/rpc';

/** Each route as the procedure named by its operationId: the same pipeline, the JSON body already read by Nest. */
function servingProcedures(
  served: Served,
): (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => void {
  const handler = new RPCHandler(orpcRouter(served.routes, served.boundary));

  return (request, response, next) => {
    const context = { headers: request.headers, raw: request };

    void handler.handle(request, response, { prefix: RPC_PREFIX, context }).then(({ matched }) => {
      if (!matched) {
        next();
      }
    }, next);
  };
}
{{/if}}
{{#if rpc.trpc}}

const TRPC_ENDPOINT = '/trpc';

/** Each route as the procedure named by its operationId, its path what Nest leaves of the URL: the JSON body already read by Nest. */
function servingProcedures(served: Served): RequestListener {
  return createHTTPHandler({
    router: trpcRouter(served.routes, served.boundary),
    createContext: ({ req }) => ({ headers: req.headers, raw: req }),
  });
}
{{/if}}

// Nest types its HTTP server loosely: the port is read only from what proves to be a Node server.
function boundPort(server: unknown): number {
  const address = server instanceof Server ? server.address() : null;

  return typeof address === 'object' && address !== null ? address.port : 0;
}
