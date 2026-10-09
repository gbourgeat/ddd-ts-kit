import Fastify from 'fastify';
import type { ErrorContext, Route } from '@ddd-ts-kit/http';
import { mountFastify } from '@ddd-ts-kit/http/fastify';
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
  const app = Fastify();
{{#if docs.any}}
  mountFastify(app, withDocumentation(routes, config), { onError: logServerFault });
{{/if}}
{{#unless docs.any}}
  mountFastify(app, routes, { onError: logServerFault });
{{/unless}}
  await app.listen({ port: config.port, host: '0.0.0.0' });
  const [address] = app.addresses();
  return { port: address?.port ?? 0, close: () => app.close() };
}

// The error message may quote data: only the code and the route are logged.
function logServerFault(_error: unknown, context: ErrorContext): void {
  if (context.problem.status >= 500) {
    console.error(JSON.stringify({ level: 'error', requestId: context.requestId, operationId: context.operationId, code: context.problem.code }));
  }
}
