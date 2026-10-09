import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  assertUniqueRoutes,
  executeRoute,
  serializeBody,
  type ExecuteOptions,
  type Route,
} from './index.js';

export type FastifyMountOptions = ExecuteOptions;

/** Registers the routes on a Fastify 5 instance. Validation stays in the shared pipeline. */
export function mountFastify(
  instance: FastifyInstance,
  routes: readonly Route[],
  options: FastifyMountOptions = {},
): void {
  assertUniqueRoutes(routes);
  for (const route of routes) {
    instance.route({
      method: route.method,
      url: route.path,
      handler: async (request, reply) => {
        const result = await executeRoute(
          route,
          {
            params: request.params,
            query: request.query,
            headers: request.headers,
            body: request.body,
            raw: request,
          },
          options,
        );
        return reply.code(result.status).headers(result.headers).send(serializeBody(result));
      },
    });
  }
}

/** The same as `mountFastify`, as a plugin: `app.register(fastifyRoutes(routes), { prefix })`. */
export function fastifyRoutes(
  routes: readonly Route[],
  options: FastifyMountOptions = {},
): FastifyPluginAsync {
  assertUniqueRoutes(routes);
  return async (instance) => {
    mountFastify(instance, routes, options);
  };
}
