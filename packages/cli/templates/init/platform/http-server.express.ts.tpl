import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { ErrorContext, Route } from '@ddd-ts-kit/http';
import { mountExpress } from '@ddd-ts-kit/http/express';
import type { AppConfig } from './config.js';
{{#if docs.any}}
import { withDocumentation } from './http-docs.js';
{{/if}}

export interface HttpServer {
  /** The port really bound: differs from the configured one when that was 0. */
  readonly port: number;
  close(): Promise<void>;
}

export async function startHttpServer(routes: readonly Route[], config: AppConfig): Promise<HttpServer> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
{{#if docs.any}}
  mountExpress(app, withDocumentation(routes, config), { onError: logServerFault });
{{/if}}
{{#unless docs.any}}
  mountExpress(app, routes, { onError: logServerFault });
{{/unless}}
  const server = await listen(app, config.port);
  return { port: boundPort(server), close: () => close(server) };
}

// The error message may quote data: only the code and the route are logged.
function logServerFault(_error: unknown, context: ErrorContext): void {
  if (context.problem.status >= 500) {
    console.error(JSON.stringify({ level: 'error', requestId: context.requestId, operationId: context.operationId, code: context.problem.code }));
  }
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
