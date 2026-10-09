import 'reflect-metadata';
import { Server } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { createAppModule, type Application } from './application.js';
import type { AppConfig } from './config.js';
{{#if docs.any}}
import { withDocumentation } from './http-docs.js';
{{/if}}
{{#if cache.rateLimit}}
import { refusalFor } from './http-rate-limit.js';
{{/if}}

export interface HttpServer {
  /** The port really bound: differs from the configured one when that was 0. */
  readonly port: number;
  close(): Promise<void>;
}

/** What the server needs of the application: its routes and what stands at its edge. */
type Served = Pick<Application, 'routes' | 'boundary'{{#if cache.rateLimit}} | 'rateLimiter' | 'ready'{{/if}}>;
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
{{/if}}

export async function startHttpServer(served: Served, config: AppConfig): Promise<HttpServer> {
{{#if docs.any}}
  const app = await NestFactory.create(createAppModule(withDocumentation(served.routes, config), served.boundary), { logger: ['error', 'warn'] });
{{/if}}
{{#unless docs.any}}
  const app = await NestFactory.create(createAppModule(served.routes, served.boundary), { logger: ['error', 'warn'] });
{{/unless}}
{{#if cache.rateLimit}}
  app.use((request: Incoming, response: Outgoing, next: () => void) => void guardTheDoor({ served, config }, { request, response, next }));
{{/if}}
  await app.listen(config.port);
  return { port: boundPort(app.getHttpServer()), close: () => app.close() };
}
{{#if cache.rateLimit}}

interface Door {
  readonly served: Served;
  readonly config: AppConfig;
}

interface Exchange {
  readonly request: Incoming;
  readonly response: Outgoing;
  readonly next: () => void;
}

/** The readiness probe, then the limiter, before any route. */
async function guardTheDoor({ served, config }: Door, { request, response, next }: Exchange): Promise<void> {
  if (request.url === '/health/ready') {
    const ready = await served.ready();
    response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' }).end(JSON.stringify({ status: ready ? 'up' : 'down' }));
    return;
  }
  const refusal = await refusalFor(served.rateLimiter, config.rateLimit, request.socket.remoteAddress);
  if (refusal === undefined) next();
  else response.writeHead(refusal.problem.status, refusal.headers).end(JSON.stringify(refusal.problem));
}
{{/if}}

// Nest types its HTTP server loosely: the port is read only from what proves to be a Node server.
function boundPort(server: unknown): number {
  const address = server instanceof Server ? server.address() : null;
  return typeof address === 'object' && address !== null ? address.port : 0;
}
