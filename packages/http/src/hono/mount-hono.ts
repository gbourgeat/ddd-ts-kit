import type { Context, Hono } from 'hono';
import { executeRoute } from '../pipeline/execute-route.js';
import { serializeBody } from '../pipeline/serialize-body.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { Route } from '../route/route.js';
import type { HonoMountOptions } from './hono-mount-options.js';
import type { HonoRaw } from './hono-raw.js';
import { readBody } from './read-body.js';
import { malformedBody } from './malformed-body.js';

type HonoHandler = (context: Context) => Promise<Response>;

/**
 * Registers the routes on a Hono application. The adapter reads the JSON body itself: a body
 * that is not JSON is answered 400 as a problem, before the pipeline runs.
 */
export function mountHono(app: Pick<Hono, 'on'>, routes: readonly Route[], options: HonoMountOptions = {}): void {
  assertUniqueRoutes(routes);

  for (const route of routes) {
    app.on(route.method, route.path, handlerOf(route, options));
  }
}

function handlerOf(route: Route, options: HonoMountOptions): HonoHandler {
  return async (context) => {
    const headers = context.req.header();
    const body = await readBody(context);

    if (!body.read) {
      return malformedBody(headers);
    }

    const raw: HonoRaw = { headers, context };

    const result = await executeRoute(
      route,
      { params: context.req.param(), query: queryOf(context), headers, body: body.value, raw },
      options,
    );

    return new Response(serializeBody(result) ?? null, { status: result.status, headers: result.headers });
  };
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
