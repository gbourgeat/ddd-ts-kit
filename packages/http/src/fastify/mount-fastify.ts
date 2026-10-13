import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { executeRoute } from '../pipeline/execute-route.js';
import { serializeBody } from '../pipeline/serialize-body.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { Route } from '../route/route.js';
import type { FastifyMountOptions } from './fastify-mount-options.js';

/**
 * Registers the routes on a Fastify 5 instance. Validation stays in the shared pipeline. The
 * routes that read their body as a stream (an upload, a raw body) are registered in a context of
 * their own, where no body parser runs: the rest of the instance keeps its parsers.
 */
export function mountFastify(
  instance: FastifyInstance,
  routes: readonly Route[],
  options: FastifyMountOptions = {},
): void {
  assertUniqueRoutes(routes);

  const streamed = routes.filter(readsItsStream);

  register(
    instance,
    routes.filter((route) => !readsItsStream(route)),
    options,
  );

  if (streamed.length > 0) {
    void instance.register(async (unparsed) => {
      unparsed.removeAllContentTypeParsers();

      unparsed.addContentTypeParser('*', (_request, _payload, done) => {
        done(null);
      });

      register(unparsed, streamed, options);
    });
  }
}

function readsItsStream(route: Route): boolean {
  return route.upload !== undefined || route.rawBody === true;
}

function register(instance: FastifyInstance, routes: readonly Route[], options: FastifyMountOptions): void {
  for (const route of routes) {
    instance.route({
      method: route.method,
      url: route.path,
      handler: async (request, reply) => {
        const { params, query, headers, body } = request;
        const raw = { params, query, headers, body, raw: request, stream: request.raw };
        const result = await executeRoute(route, raw, options);
        const sent = result.body instanceof Readable ? result.body : serializeBody(result);

        return reply.code(result.status).headers(result.headers).send(sent);
      },
    });
  }
}
