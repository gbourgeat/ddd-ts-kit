import { Readable } from 'node:stream';
import type { Context, Hono } from 'hono';
import { assertCachedRoutes } from '../pipeline/assert-cached-routes';
import { executeRoute } from '../pipeline/execute-route';
import type { RawRequest } from '../pipeline/raw-request';
import type { RouteResponse } from '../pipeline/route-response';
import { serializeBody } from '../pipeline/serialize-body';
import { assertServed } from '../representation/assert-served';
import { assertUniqueRoutes } from '../route/assert-unique-routes';
import type { Route } from '../route/route';
import { edgeProblem } from './edge-problem';
import type { HonoMountOptions } from './hono-mount-options';
import type { HonoRaw } from './hono-raw';
import { readBody } from './read-body';

type HonoHandler = (context: Context) => Promise<Response>;

/** What Fastify reads at most by default: the same bound on every adapter that sets its own. */
const ONE_MEBIBYTE = 1_048_576;

/**
 * Registers the routes on a Hono application. The adapter reads the JSON body itself, up to
 * `bodyLimit` (1 MiB by default): a larger body is answered 413 and a body that is not JSON 400,
 * both as problems, before the pipeline runs. A body in a media type the route consumes
 * (`consumes`) is read as text under the same limit, for its representation. An upload and a raw
 * body are read from the request stream; a body that is a stream, or a streamed list, is
 * streamed to the response.
 */
export function mountHono(app: Pick<Hono, 'on'>, routes: readonly Route[], options: HonoMountOptions = {}): void {
  assertUniqueRoutes(routes);
  assertServed(routes, options.representations);
  assertCachedRoutes(routes, options);

  for (const route of routes) {
    app.on(route.method, route.path, handlerOf(route, options));
  }
}

function handlerOf(route: Route, options: HonoMountOptions): HonoHandler {
  const { bodyLimit = ONE_MEBIBYTE, ...execute } = options;

  return async (context) => {
    const request = streamed(route) ? streamRequest(context) : await bodyRequest(context, route, bodyLimit);

    if (request instanceof Response) {
      return request;
    }

    return responseOf(await executeRoute(route, request, execute));
  };
}

function streamed(route: Route): boolean {
  return route.upload !== undefined || route.rawBody === true;
}

function streamRequest(context: Context): RawRequest {
  const { body } = context.req.raw;

  return {
    ...common(context),
    body: undefined,
    ...(body === null ? {} : { stream: Readable.fromWeb(body) }),
  };
}

async function bodyRequest(context: Context, route: Route, limit: number): Promise<RawRequest | Response> {
  const body = await readBody(context, limit, route.consumes);

  if (!body.read) {
    return edgeProblem(context.req.header(), body.refusal);
  }

  return { ...common(context), body: body.value };
}

function common(context: Context): Omit<RawRequest, 'body'> {
  const headers = context.req.header();
  const raw: HonoRaw = { headers, context };

  return { params: context.req.param(), query: queryOf(context), headers, raw };
}

function responseOf(result: RouteResponse): Response {
  return new Response(sentOf(result), { status: result.status, headers: result.headers });
}

/** A file as it is, a streamed list as a stream of its chunks, anything else serialized. */
function sentOf(result: RouteResponse): ReadableStream | string | Uint8Array | null {
  if (result.body instanceof Readable) {
    return Readable.toWeb(result.body);
  }

  return result.stream === undefined ? (serializeBody(result) ?? null) : Readable.toWeb(Readable.from(result.stream));
}

/** A repeated key keeps its values as a list, a single one is a string: what Express and Fastify answer. */
function queryOf(context: Context): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(context.req.queries()).map(([name, values]) => [
      name,
      values.length === 1 ? (values[0] ?? '') : values,
    ]),
  );
}
