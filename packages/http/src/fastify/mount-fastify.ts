import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { executeRoute } from '../pipeline/execute-route.js';
import { serializeBody } from '../pipeline/serialize-body.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { Route } from '../route/route.js';
import type { FastifyMountOptions } from './fastify-mount-options.js';

/**
 * Registers the routes on a Fastify 5 instance. Validation stays in the shared pipeline. A media
 * type a route consumes (`consumes`) is given a parser that hands the body over as text.
 */
export function mountFastify(
  instance: FastifyInstance,
  routes: readonly Route[],
  options: FastifyMountOptions = {},
): void {
  assertUniqueRoutes(routes);
  options.representations?.assertServes(routes);
  readAsText(instance, routes);

  for (const route of routes) {
    instance.route({
      method: route.method,
      url: route.path,
      handler: async (request, reply) => {
        const { params, query, headers, body } = request;
        const result = await executeRoute(route, { params, query, headers, body, raw: request }, options);
        const sent = result.stream === undefined ? serializeBody(result) : Readable.from(result.stream);

        return reply.code(result.status).headers(result.headers).send(sent);
      },
    });
  }
}

function readAsText(instance: FastifyInstance, routes: readonly Route[]): void {
  const consumed = new Set(routes.flatMap((route) => route.consumes ?? []));

  for (const mediaType of [...consumed].filter((type) => !instance.hasContentTypeParser(type))) {
    instance.addContentTypeParser(mediaType, { parseAs: 'string' }, (_request, body, done) => {
      done(null, body);
    });
  }
}
