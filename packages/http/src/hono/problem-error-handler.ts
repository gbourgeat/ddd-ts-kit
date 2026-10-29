import type { Context } from 'hono';
import { answeredEdgeError, type EdgeErrorOptions } from '../error/answered-edge-error';

type HonoErrorHandler = (error: Error, context: Context) => Response;

/**
 * The error handler of a Hono application: answers as a problem the failure of a middleware in
 * front of the routes, instead of the default handler of Hono, which answers a text and writes
 * the error to stderr. The routes of the kit answer their own refusals, a body included:
 * `app.onError(problemErrorHandler({ logger }))`.
 */
export function problemErrorHandler(options: EdgeErrorOptions = {}): HonoErrorHandler {
  return (error, context) => {
    const answer = answeredEdgeError({ error, headers: context.req.header() }, options);

    return new Response(JSON.stringify(answer.problem), { status: answer.status, headers: answer.headers });
  };
}
