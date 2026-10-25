import { Readable } from 'node:stream';
import { ORPCError } from '@orpc/server';
import type { Problem } from '../error/problem';
import type { RouteResponse } from '../pipeline/route-response';
import { NOT_ACCEPTABLE } from '../representation/not-acceptable-error';
import { isAsyncIterable } from '../support/is-async-iterable';
import { isRecord } from '../support/is-record';

const FIRST_REFUSAL_STATUS = 400;
const NOT_ACCEPTABLE_STATUS = 406;

/**
 * What a procedure returns for the answer of its route: the body of a success as JSON writes it,
 * a binary body as a `Blob`. A refusal is thrown as an `ORPCError` whose code is the code of the
 * problem, its status the status, and its data the problem document itself. A file and a list
 * read as it comes are refused with 406 and closed: they are streamed because they may not fit in
 * memory, and only the HTTP route streams them.
 */
export async function rpcAnswer(response: RouteResponse): Promise<unknown> {
  if (response.status >= FIRST_REFUSAL_STATUS) {
    throw refusalOf(response);
  }

  const { body } = response;

  if (body instanceof Readable) {
    body.destroy();

    throw streamedRefusal('a file');
  }

  // No representation writes it: the pipeline hands over a list read as it comes as the body itself.
  if (isAsyncIterable(body)) {
    await body[Symbol.asyncIterator]().return?.();

    throw streamedRefusal('a list read as it comes');
  }

  if (body instanceof Uint8Array) {
    return new Blob([body], { type: response.headers['content-type'] });
  }

  return isJson(response) && body !== undefined ? JSON.parse(JSON.stringify(body)) : body;
}

/**
 * A JSON body is returned as the HTTP route writes it, a date as its text: what the contract, and
 * the client generated from it, say it is, which the serializer of oRPC would otherwise keep a `Date`.
 */
function isJson(response: RouteResponse): boolean {
  return /[/+]json\b/.test(response.headers['content-type'] ?? '');
}

/** A refusal the route answers itself, without a problem document, keeps its status and its body under the code `HTTP_<status>`. */
function refusalOf(response: RouteResponse): ORPCError<string, unknown> {
  const problem = response.body;

  if (!isProblem(problem)) {
    return new ORPCError(`HTTP_${String(response.status)}`, { status: response.status, data: problem });
  }

  return new ORPCError(problem.code, {
    defined: true,
    status: response.status,
    message: problem.detail ?? problem.title,
    data: problem,
  });
}

function isProblem(body: unknown): body is Problem {
  return isRecord(body) && typeof body['code'] === 'string' && typeof body['title'] === 'string';
}

function streamedRefusal(what: string): ORPCError<string, undefined> {
  return new ORPCError(NOT_ACCEPTABLE, {
    status: NOT_ACCEPTABLE_STATUS,
    message: `This operation answers ${what}, which only its HTTP route streams.`,
  });
}
