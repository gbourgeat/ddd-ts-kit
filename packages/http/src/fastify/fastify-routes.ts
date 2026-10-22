import type { FastifyPluginAsync } from 'fastify';
import { assertUniqueRoutes } from '../route/assert-unique-routes';
import type { Route } from '../route/route';
import type { FastifyMountOptions } from './fastify-mount-options';
import { mountFastify } from './mount-fastify';

/** The same as `mountFastify`, as a plugin: `app.register(fastifyRoutes(routes), { prefix })`. */
export function fastifyRoutes(routes: readonly Route[], options: FastifyMountOptions = {}): FastifyPluginAsync {
  assertUniqueRoutes(routes);

  return async (instance) => {
    mountFastify(instance, routes, options);
  };
}
