import type { FastifyInstance } from 'fastify';
import { assertCachedRoutes } from '../pipeline/assert-cached-routes.js';
import { executeRoute } from '../pipeline/execute-route.js';
import { serializeBody } from '../pipeline/serialize-body.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { Route } from '../route/route.js';
import type { FastifyMountOptions } from './fastify-mount-options.js';

/** Registers the routes on a Fastify 5 instance. Validation stays in the shared pipeline. */
export function mountFastify(
  instance: FastifyInstance,
  routes: readonly Route[],
  options: FastifyMountOptions = {},
): void {
  assertUniqueRoutes(routes);
  assertCachedRoutes(routes, options);

  for (const route of routes) {
    instance.route({
      method: route.method,
      url: route.path,
      handler: async (request, reply) => {
        const { params, query, headers, body } = request;
        const result = await executeRoute(route, { params, query, headers, body, raw: request }, options);

        return reply.code(result.status).headers(result.headers).send(serializeBody(result));
      },
    });
  }
}
