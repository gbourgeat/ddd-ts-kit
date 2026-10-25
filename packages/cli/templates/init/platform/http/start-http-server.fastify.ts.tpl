import Fastify{{#if cache.rateLimit}}, { type FastifyInstance }{{/if}}{{#unless cache.rateLimit}}{{#if rpc.orpc}}, { type FastifyInstance }{{/if}}{{/unless}} from 'fastify';
import { mountFastify } from '@ddd-ts-kit/http/fastify';
{{#if rpc.orpc}}
import { orpcRouter } from '@ddd-ts-kit/http/orpc';
import { RPCHandler } from '@orpc/server/fastify';
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
 * server), the signed file links (with a storage the application serves), the routes of the
 * contexts, then the pages of the contract (with documentation on).{{#if rpc.orpc}} The same routes are served
 * as oRPC procedures under /rpc, for the typed client of the contract.{{/if}}
 */
export async function startHttpServer(served: Served, config: AppConfig): Promise<HttpServer> {
  const app = Fastify();

{{#if cache.rateLimit}}
  answerReadiness(app, served);
  limitEachCaller(app, served, config);
{{/if}}
{{#if files.http}}
  mountFastify(app, served.fileRoutes, served.boundary);
{{/if}}
{{#if docs.any}}
  mountFastify(app, withDocumentation(served.routes, config, served.boundary), served.boundary);
{{/if}}
{{#unless docs.any}}
  mountFastify(app, served.routes, served.boundary);
{{/unless}}
{{#if rpc.orpc}}
  serveProcedures(app, served);
{{/if}}
  await app.listen({ port: config.port, host: '0.0.0.0' });

  const [address] = app.addresses();

  return { port: address?.port ?? 0, close: () => app.close() };
}
{{#if cache.rateLimit}}

/** Whether the Redis protocol server answers, for the load balancer; never limited, since it is polled. */
function answerReadiness(app: FastifyInstance, served: Served): void {
  app.get('/health/ready', async (_request, reply) => {
    const ready = await served.ready();

    return reply.code(ready ? 200 : 503).send({ status: ready ? 'up' : 'down' });
  });
}

/** One sliding window per caller address, before authentication costs anything. */
function limitEachCaller(app: FastifyInstance, served: Served, config: AppConfig): void {
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health/ready') {
      return;
    }

    const tooMany = await tooManyRequestsFor(served.rateLimiter, config.rateLimit, request.ip);

    if (tooMany !== undefined) {
      await reply.code(tooMany.status).headers(tooMany.headers).send(tooMany.body);
    }
  });
}
{{/if}}
{{#if rpc.orpc}}

const RPC_PREFIX = '/rpc';

/** Each route as the procedure named by its operationId: the same pipeline, the JSON body already read by Fastify. */
function serveProcedures(app: FastifyInstance, served: Served): void {
  const handler = new RPCHandler(orpcRouter(served.routes, served.boundary));

  app.all(`${RPC_PREFIX}/*`, async (request, reply) => {
    const context = { headers: request.headers, raw: request };
    const { matched } = await handler.handle(request, reply, { prefix: RPC_PREFIX, context });

    if (!matched) {
      reply.callNotFound();
    }
  });
}
{{/if}}
