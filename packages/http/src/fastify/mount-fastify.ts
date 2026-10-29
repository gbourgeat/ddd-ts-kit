import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { assertCachedRoutes } from '../pipeline/assert-cached-routes';
import { executeRoute } from '../pipeline/execute-route';
import type { RouteResponse } from '../pipeline/route-response';
import { serializeBody } from '../pipeline/serialize-body';
import { assertServed } from '../representation/assert-served';
import { assertUniqueRoutes } from '../route/assert-unique-routes';
import type { Route } from '../route/route';
import type { FastifyMountOptions } from './fastify-mount-options';

/**
 * Registers the routes on a Fastify 5 instance. Validation stays in the shared pipeline. The
 * routes are registered in a context of their own: where they read JSON, an empty body reaches
 * them as absent, as on Express and Hono; those that read their body as a stream (an upload, a raw
 * body) in another, where no body parser runs. The rest of the instance keeps its parsers. A media
 * type a route consumes (`consumes`) is given a parser that hands the body over as text.
 */
export function mountFastify(
  instance: FastifyInstance,
  routes: readonly Route[],
  options: FastifyMountOptions = {},
): void {
  assertUniqueRoutes(routes);
  assertServed(routes, options.representations);
  assertCachedRoutes(routes, options);

  const streamed = routes.filter(readsItsStream);
  const parsed = routes.filter((route) => !readsItsStream(route));

  readAsText(instance, parsed);

  void instance.register(async (scope) => {
    readEmptyJsonAsAbsent(scope);
    register(scope, parsed, options);
  });

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

/**
 * The JSON parser of Fastify refuses an empty body (`FST_ERR_CTP_EMPTY_JSON_BODY`), which Express
 * and Hono hand over as absent: in the context of the routes, an empty body is absent, any other
 * read by the parser of Fastify, so that the validation of the route decides on every framework.
 */
function readEmptyJsonAsAbsent(scope: FastifyInstance): void {
  const { onProtoPoisoning, onConstructorPoisoning } = scope.initialConfig;
  const parse = scope.getDefaultJsonParser(onProtoPoisoning ?? 'error', onConstructorPoisoning ?? 'error');

  scope.removeContentTypeParser('application/json');

  scope.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const text = String(body);

    if (text === '') {
      done(null, undefined);
    } else {
      void parse(request, text, done);
    }
  });
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
