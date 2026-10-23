import 'reflect-metadata';
import { Server } from 'node:http';
import { NestFactory } from '@nestjs/core';
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
type Served = Pick<Application, 'routes' | 'boundary'{{#if cache.rateLimit}} | 'rateLimiter' | 'ready'{{/if}}{{#if files.http}} | 'fileRoutes'{{/if}}>;
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
 * the signed file links (with a storage the application serves), all in one Nest module.
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

  const app = await NestFactory.create(createAppModule(routes, served.boundary), { logger: ['error', 'warn'] });

{{#if cache.rateLimit}}
  app.use(answeringReadiness(served));
  app.use(limitingEachCaller(served, config));

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

// Nest types its HTTP server loosely: the port is read only from what proves to be a Node server.
function boundPort(server: unknown): number {
  const address = server instanceof Server ? server.address() : null;

  return typeof address === 'object' && address !== null ? address.port : 0;
}
