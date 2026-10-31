import type { FastifyReply, FastifyRequest } from 'fastify';
import type { EdgeErrorOptions } from '../error/answered-edge-error';
import { answeredNotFound } from '../error/answered-not-found';

type FastifyNotFoundHandler = (request: FastifyRequest, reply: FastifyReply) => FastifyReply;

/**
 * The not-found handler of a Fastify instance: answers a path no route serves 404 `NOT_FOUND` as
 * a problem, instead of the default of Fastify, `{ message, error, statusCode }`:
 * `app.setNotFoundHandler(problemNotFoundHandler({ logger }))`.
 */
export function problemNotFoundHandler(options: EdgeErrorOptions = {}): FastifyNotFoundHandler {
  return (request, reply) => {
    const answer = answeredNotFound(request.headers, options);

    return reply.code(answer.status).headers(answer.headers).send(JSON.stringify(answer.problem));
  };
}
