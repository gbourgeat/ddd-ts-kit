import type { FastifyPluginAsync } from 'fastify';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { Route } from '../route/route.js';
import type { FastifyMountOptions } from './fastify-mount-options.js';
import { mountFastify } from './mount-fastify.js';

/** The same as `mountFastify`, as a plugin: `app.register(fastifyRoutes(routes), { prefix })`. */
export function fastifyRoutes(routes: readonly Route[], options: FastifyMountOptions = {}): FastifyPluginAsync {
  assertUniqueRoutes(routes);

  return async (instance) => {
    mountFastify(instance, routes, options);
  };
}
