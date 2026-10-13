import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';
{{#if cache.rateLimit}}
import { getConnInfo } from '@hono/node-server/conninfo';
{{/if}}
import { Hono } from 'hono';
import { mountHono } from '@ddd-ts-kit/http/hono';
import type { Application } from '{{alias.platform}}/compose-application{{alias.ext}}';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
{{#if cache.rateLimit}}
import { refusalFor } from '{{alias.platform}}/http/refusal-for{{alias.ext}}';
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
type Served = Pick<Application, 'routes' | 'boundary'{{#if cache.rateLimit}} | 'rateLimiter' | 'ready'{{/if}}>;

export async function startHttpServer(served: Served, config: AppConfig): Promise<HttpServer> {
  const app = new Hono();

{{#if cache.rateLimit}}
  guardTheDoor(app, served, config);
{{/if}}
{{#if docs.any}}
  mountHono(app, withDocumentation(served.routes, config), served.boundary);
{{/if}}
{{#unless docs.any}}
  mountHono(app, served.routes, served.boundary);
{{/unless}}

  const server = await listen(app, config.port);

  return { port: boundPort(server), close: () => close(server) };
}
{{#if cache.rateLimit}}

/** The readiness probe, then the limiter, before any route. */
function guardTheDoor(app: Hono, served: Served, config: AppConfig): void {
  app.get('/health/ready', async (context) => {
    const ready = await served.ready();

    return context.json({ status: ready ? 'up' : 'down' }, ready ? 200 : 503);
  });

  app.use(async (context, next) => {
    const refusal = await refusalFor(served.rateLimiter, config.rateLimit, getConnInfo(context).remote.address);

    if (refusal === undefined) {
      await next();

      return undefined;
    }

    return new Response(JSON.stringify(refusal.problem), { status: refusal.problem.status, headers: refusal.headers });
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
