import { identifyError, type Logger } from '@ddd-ts-kit/kernel';
import type { RawHeaders } from '../route/raw-headers';
import { codeOfStatus } from './code-of-status';
import { type EdgeAnswer, edgeAnswer } from './edge-answer';
import { bodyTooLarge, type EdgeRefusal, MALFORMED_BODY } from './edge-refusal';
import { INTERNAL_ERROR_CODE } from './internal-error-code';
import { refusalHeaders } from './refusal-headers';
import { statusTitle } from './status-title';

export interface EdgeErrorOptions {
  /**
   * Where each error is written: its type (`entity.parse.failed`, `FST_ERR_CTP_BODY_TOO_LARGE`,
   * the class of an unexpected error), the status answered and the request id, never its message
   * nor the body, which may quote personal data. A refusal is a warning, a failure an error.
   * Left out, nothing is written.
   */
  readonly logger?: Logger;
}

/** What reached the framework, and the request it came with. */
export interface EdgeError {
  readonly error: unknown;
  readonly headers: Readonly<RawHeaders>;
  /** What the error is, when the adapter knows better than the error says (Nest wraps the error of its parser). */
  readonly refusal?: EdgeRefusal;
}

/** What `express.json()` (body-parser) and the parser of Fastify name a body that is not JSON; an empty body is not one. */
const MALFORMED_KINDS = new Set(['entity.parse.failed', 'FST_ERR_CTP_INVALID_JSON_BODY']);

const KIND = /^[A-Za-z0-9_.]{1,64}$/;

const CONTENT_TOO_LARGE = 413;
const FIRST_REFUSAL = 400;
const LAST_FAILURE = 599;

const INTERNAL: EdgeRefusal = { status: 500, title: statusTitle(500), code: INTERNAL_ERROR_CODE };

/**
 * The answer to an error the framework raised before a route of the kit ran, or a middleware
 * passed on: a body refused by its parser, the failure of a middleware. A body that is not JSON
 * is `MALFORMED_BODY` (400), an error with the status 413 `BODY_TOO_LARGE`, another error that
 * carries a status of a refusal or of a failure (`status` or `statusCode`, 4xx or 5xx) that
 * status, its code the one the kit gives it (`NOT_FOUND`, `VALIDATION_FAILED` for 422,
 * `SERVICE_UNAVAILABLE` for the 503 of a store down), anything else `INTERNAL_ERROR` (500). The
 * message of the error is never answered: a parser quotes the body in it. The headers an error with
 * a status carries for its client (`WWW-Authenticate`, `Allow`, `Retry-After`) are kept.
 */
export function answeredEdgeError({ error, headers, refusal }: EdgeError, options: EdgeErrorOptions): EdgeAnswer {
  const refused = edgeAnswer(headers, refusal ?? refusalOf(error));
  // The headers of the refusal under those of the problem: a challenge kept, the media type and the identifiers the problem's.
  const kept = statusOf(error) === undefined ? {} : refusalHeaders(error);
  const answer = { ...refused, headers: { ...kept, ...refused.headers } };
  const fields = { errorType: typeOf(error), status: answer.status, requestId: answer.problem.requestId };

  if (answer.status >= 500) {
    options.logger?.error('request failed before its route', fields);
  } else {
    options.logger?.warn('request refused before its route', fields);
  }

  return answer;
}

function refusalOf(error: unknown): EdgeRefusal {
  const kind = kindOf(error);

  if (kind !== undefined && MALFORMED_KINDS.has(kind)) {
    return MALFORMED_BODY;
  }

  const status = statusOf(error);

  if (status === undefined) {
    return INTERNAL;
  }

  if (status === CONTENT_TOO_LARGE) {
    return bodyTooLarge(numberAt(error, 'limit'));
  }

  return { status, title: statusTitle(status), code: codeOfStatus(status) };
}

/** The status the error carries (`status`, else `statusCode`), when it is one of a refusal or of a failure. */
function statusOf(error: unknown): number | undefined {
  const status = numberAt(error, 'status') ?? numberAt(error, 'statusCode');

  return status !== undefined && Number.isInteger(status) && status >= FIRST_REFUSAL && status <= LAST_FAILURE
    ? status
    : undefined;
}

/** The `type` body-parser gives its errors, else the `code` of a Fastify error. */
function kindOf(error: unknown): string | undefined {
  const kind = textAt(error, 'type') ?? textAt(error, 'code');

  return kind !== undefined && KIND.test(kind) ? kind : undefined;
}

function typeOf(error: unknown): string {
  return kindOf(error) ?? identifyError(error).errorType;
}

function textAt(error: unknown, key: string): string | undefined {
  const value = valueAt(error, key);

  return typeof value === 'string' ? value : undefined;
}

function numberAt(error: unknown, key: string): number | undefined {
  const value = valueAt(error, key);

  return typeof value === 'number' ? value : undefined;
}

function valueAt(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null ? Reflect.get(error, key) : undefined;
}
