import type { RequestHandler } from 'express';
import type { EdgeErrorOptions } from '../error/answered-edge-error';
import { answeredNotFound } from '../error/answered-not-found';

/**
 * The middleware after the routes of an Express application: answers a path no route serves
 * 404 `NOT_FOUND` as a problem, instead of the final handler of Express, which answers the HTML
 * page `Cannot GET /path`. Installed after every route, before `problemErrorHandler`:
 * `app.use(problemNotFoundHandler({ logger }))`.
 */
export function problemNotFoundHandler(options: EdgeErrorOptions = {}): RequestHandler {
  return (request, response) => {
    const answer = answeredNotFound(request.headers, options);

    response.status(answer.status).set(answer.headers).send(JSON.stringify(answer.problem));
  };
}
