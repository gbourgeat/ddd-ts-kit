import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { executeRoute } from '../pipeline/execute-route.js';
import type { RouteResponse } from '../pipeline/route-response.js';
import { serializeBody } from '../pipeline/serialize-body.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { Route } from '../route/route.js';
import type { FastifyMountOptions } from './fastify-mount-options.js';

/**
 * Registers the routes on a Fastify 5 instance. Validation stays in the shared pipeline. The
 * routes that read their body as a stream (an upload, a raw body) are registered in a context of
 * their own, where no body parser runs: the rest of the instance keeps its parsers. A media type
 * a route consumes (`consumes`) is given a parser that hands the body over as text.
 */
export function mountFastify(
  instance: FastifyInstance,
  routes: readonly Route[],
  options: FastifyMountOptions = {},
): void {
  assertUniqueRoutes(routes);
  options.representations?.assertServes(routes);

  const streamed = routes.filter(readsItsStream);
  const parsed = routes.filter((route) => !readsItsStream(route));

  readAsText(instance, parsed);
  register(instance, parsed, options);

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

function readAsText(instance: FastifyInstance, routes: readonly Route[]): void {
  const consumed = new Set(routes.flatMap((route) => route.consumes ?? []));

  for (const mediaType of [...consumed].filter((type) => !instance.hasContentTypeParser(type))) {
    instance.addContentTypeParser(mediaType, { parseAs: 'string' }, (_request, body, done) => {
      done(null, body);
    });
  }
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

        return reply.code(result.status).headers(result.headers).send(sentOf(result));
      },
    });
  }
}

/** A file as it is, a streamed list as a stream of its chunks, anything else serialized. */
function sentOf(result: RouteResponse): Readable | string | Uint8Array | undefined {
  if (result.body instanceof Readable) {
    return result.body;
  }

  return result.stream === undefined ? serializeBody(result) : Readable.from(result.stream);
}
