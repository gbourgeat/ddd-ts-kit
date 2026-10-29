import type { ErrorRequestHandler } from 'express';
import { answeredEdgeError, type EdgeErrorOptions } from '../error/answered-edge-error';

/**
 * The last middleware of an Express application: answers as a problem what reached Express before
 * a route of the kit could, a body `express.json()` refused (`MALFORMED_BODY` 400,
 * `BODY_TOO_LARGE` 413) or the error a middleware passed to `next`, instead of the final handler
 * of Express, which answers an HTML page with the stack outside production and writes the error,
 * the body it quotes included, to stderr. Installed after every route:
 * `app.use(problemErrorHandler({ logger }))`.
 */
export function problemErrorHandler(options: EdgeErrorOptions = {}): ErrorRequestHandler {
  // eslint-disable-next-line ddd-ts-kit/clean-function-size -- Express tells an error middleware by its four parameters
  return (error: unknown, request, response, _next) => {
    const answer = answeredEdgeError({ error, headers: request.headers }, options);

    if (response.headersSent) {
      // Too late for a problem: the client gets a response cut short, as for a failed stream.
      response.destroy();

      return;
    }

    response.status(answer.status).set(answer.headers).send(JSON.stringify(answer.problem));
  };
}
