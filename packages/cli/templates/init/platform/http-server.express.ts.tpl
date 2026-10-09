import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { mountExpress } from '@ddd-ts-kit/http/express';
import type { Application } from './application.js';
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

export async function startHttpServer(served: Served, config: AppConfig): Promise<HttpServer> {
  const app = express();
  app.disable('x-powered-by');
{{#if cache.rateLimit}}
  app.get('/health/ready', (_request, response) => void served.ready().then((ready) => response.status(ready ? 200 : 503).json({ status: ready ? 'up' : 'down' })));
  app.use((request, response, next) => {
    void refusalFor(served.rateLimiter, config.rateLimit, request.ip).then((refusal) => {
      if (refusal === undefined) next();
      else response.status(refusal.problem.status).set(refusal.headers).send(JSON.stringify(refusal.problem));
    }, next);
  });
{{/if}}
  app.use(express.json());
{{#if docs.any}}
  mountExpress(app, withDocumentation(served.routes, config), served.boundary);
{{/if}}
{{#unless docs.any}}
  mountExpress(app, served.routes, served.boundary);
{{/unless}}
  const server = await listen(app, config.port);
  return { port: boundPort(server), close: () => close(server) };
}

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
