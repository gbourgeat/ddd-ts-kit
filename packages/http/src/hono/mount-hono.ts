import { Readable } from 'node:stream';
import type { Context, Hono } from 'hono';
import { executeRoute } from '../pipeline/execute-route.js';
import type { RawRequest } from '../pipeline/raw-request.js';
import type { RouteResponse } from '../pipeline/route-response.js';
import { serializeBody } from '../pipeline/serialize-body.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { Route } from '../route/route.js';
import { edgeProblem } from './edge-problem.js';
import type { HonoMountOptions } from './hono-mount-options.js';
import type { HonoRaw } from './hono-raw.js';
import { readBody } from './read-body.js';

type HonoHandler = (context: Context) => Promise<Response>;

/** What Fastify reads at most by default: the same bound on every adapter that sets its own. */
const ONE_MEBIBYTE = 1_048_576;

/**
 * Registers the routes on a Hono application. The adapter reads the JSON body itself, up to
 * `bodyLimit` (1 MiB by default): a larger body is answered 413 and a body that is not JSON 400,
 * both as problems, before the pipeline runs. An upload and a raw body are read from the
 * request stream; a body that is a stream is streamed to the response.
 */
export function mountHono(app: Pick<Hono, 'on'>, routes: readonly Route[], options: HonoMountOptions = {}): void {
  assertUniqueRoutes(routes);

  for (const route of routes) {
    app.on(route.method, route.path, handlerOf(route, options));
  }
}

function handlerOf(route: Route, options: HonoMountOptions): HonoHandler {
  const { bodyLimit = ONE_MEBIBYTE, ...execute } = options;

  return async (context) => {
    const request = streamed(route) ? streamRequest(context) : await jsonRequest(context, bodyLimit);

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

async function jsonRequest(context: Context, limit: number): Promise<RawRequest | Response> {
  const body = await readBody(context, limit);

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
  const body = result.body instanceof Readable ? Readable.toWeb(result.body) : (serializeBody(result) ?? null);

  return new Response(body, { status: result.status, headers: result.headers });
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
