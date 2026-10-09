import Fastify from 'fastify';
import { mountFastify } from '@ddd-ts-kit/http/fastify';
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
  const app = Fastify();
{{#if cache.rateLimit}}
  app.get('/health/ready', async (_request, reply) => {
    const ready = await served.ready();
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'up' : 'down' });
  });
  app.addHook('onRequest', async (request, reply) => {
    const refusal = request.url === '/health/ready' ? undefined : await refusalFor(served.rateLimiter, config.rateLimit, request.ip);
    if (refusal !== undefined) await reply.code(refusal.problem.status).headers(refusal.headers).send(JSON.stringify(refusal.problem));
  });
{{/if}}
{{#if docs.any}}
  mountFastify(app, withDocumentation(served.routes, config), served.boundary);
{{/if}}
{{#unless docs.any}}
  mountFastify(app, served.routes, served.boundary);
{{/unless}}
  await app.listen({ port: config.port, host: '0.0.0.0' });
  const [address] = app.addresses();
  return { port: address?.port ?? 0, close: () => app.close() };
}
