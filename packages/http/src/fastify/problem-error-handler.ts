import type { FastifyReply, FastifyRequest } from 'fastify';
import { answeredEdgeError, type EdgeErrorOptions } from '../error/answered-edge-error';

type FastifyErrorHandler = (error: unknown, request: FastifyRequest, reply: FastifyReply) => FastifyReply;

/**
 * The error handler of a Fastify instance: answers as a problem what reached Fastify before a
 * route of the kit could, a body its parser refused (`MALFORMED_BODY` 400, `BODY_TOO_LARGE` 413,
 * another media type 415) or the failure of a hook, instead of the default handler of Fastify,
 * which answers `{ statusCode, code, error, message }` and the message of an unexpected error.
 * Set before the routes are mounted: `app.setErrorHandler(problemErrorHandler({ logger }))`.
 */
export function problemErrorHandler(options: EdgeErrorOptions = {}): FastifyErrorHandler {
  return (error, request, reply) => {
    const answer = answeredEdgeError({ error, headers: request.headers }, options);

    return reply.code(answer.status).headers(answer.headers).send(JSON.stringify(answer.problem));
  };
}
