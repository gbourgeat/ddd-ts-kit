import type { Context } from 'hono';
import type { EdgeErrorOptions } from '../error/answered-edge-error';
import { answeredNotFound } from '../error/answered-not-found';

type HonoNotFoundHandler = (context: Context) => Response;

/**
 * The not-found handler of a Hono application: answers a path no route serves 404 `NOT_FOUND`
 * as a problem, instead of the default of Hono, the text `404 Not Found`:
 * `app.notFound(problemNotFoundHandler({ logger }))`.
 */
export function problemNotFoundHandler(options: EdgeErrorOptions = {}): HonoNotFoundHandler {
  return (context) => {
    const answer = answeredNotFound(context.req.header(), options);

    return new Response(JSON.stringify(answer.problem), { status: answer.status, headers: answer.headers });
  };
}
