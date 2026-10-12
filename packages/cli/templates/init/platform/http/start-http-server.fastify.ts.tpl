import Fastify{{#if cache.rateLimit}}, { type FastifyInstance }{{/if}} from 'fastify';
import { mountFastify } from '@ddd-ts-kit/http/fastify';
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
type Served = Pick<Application, 'routes' | 'boundary'{{#if cache.rateLimit}} | 'rateLimiter' | 'ready'{{/if}}{{#if files.http}} | 'fileRoutes'{{/if}}>;

export async function startHttpServer(served: Served, config: AppConfig): Promise<HttpServer> {
  const app = Fastify();

{{#if cache.rateLimit}}
  guardTheDoor(app, served, config);
{{/if}}
{{#if files.http}}
  mountFastify(app, served.fileRoutes, served.boundary);
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
{{#if cache.rateLimit}}

/** The readiness probe, then the limiter, before any route. */
function guardTheDoor(app: FastifyInstance, served: Served, config: AppConfig): void {
  app.get('/health/ready', async (_request, reply) => {
    const ready = await served.ready();

    return reply.code(ready ? 200 : 503).send({ status: ready ? 'up' : 'down' });
  });

  app.addHook('onRequest', async (request, reply) => {
    const refusal =
      request.url === '/health/ready' ? undefined : await refusalFor(served.rateLimiter, config.rateLimit, request.ip);

    if (refusal !== undefined) {
      await reply.code(refusal.problem.status).headers(refusal.headers).send(JSON.stringify(refusal.problem));
    }
  });
}
{{/if}}
