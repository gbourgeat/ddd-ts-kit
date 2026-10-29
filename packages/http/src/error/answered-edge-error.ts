import { identifyError, type Logger } from '@ddd-ts-kit/kernel';
import type { RawHeaders } from '../route/raw-headers';
import { type EdgeAnswer, edgeAnswer } from './edge-answer';
import { bodyTooLarge, type EdgeRefusal, MALFORMED_BODY } from './edge-refusal';
import { INTERNAL_ERROR_CODE } from './internal-error-code';
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

/** What `express.json()` (body-parser) and the parsers of Fastify name a body that is not JSON. */
const MALFORMED_KINDS = new Set([
  'entity.parse.failed',
  'FST_ERR_CTP_INVALID_JSON_BODY',
  'FST_ERR_CTP_EMPTY_JSON_BODY',
]);

const KIND = /^[A-Za-z0-9_.]{1,64}$/;

const CONTENT_TOO_LARGE = 413;

const INTERNAL: EdgeRefusal = { status: 500, title: statusTitle(500), code: INTERNAL_ERROR_CODE };

/**
 * The answer to an error the framework raised before a route of the kit ran, or a middleware
 * passed on: a body refused by its parser, the failure of a middleware. A body that is not JSON
 * is `MALFORMED_BODY` (400), an error with the status 413 `BODY_TOO_LARGE`, another error that
 * carries a client status (`status` or `statusCode`, 4xx) that status, its code read from its
 * title (`NOT_FOUND`), anything else `INTERNAL_ERROR` (500). The message of the error is never
 * answered: a parser quotes the body in it.
 */
export function answeredEdgeError(
  error: unknown,
  headers: Readonly<RawHeaders>,
  options: EdgeErrorOptions,
): EdgeAnswer {
  const answer = edgeAnswer(headers, refusalOf(error));
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

  const status = numberAt(error, 'status') ?? numberAt(error, 'statusCode');

  if (status === undefined || !Number.isInteger(status) || status < 400 || status > 499) {
    return INTERNAL;
  }

  if (status === CONTENT_TOO_LARGE) {
    return bodyTooLarge(numberAt(error, 'limit'));
  }

  return { status, title: statusTitle(status), code: codeOfTitle(statusTitle(status)) };
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

/** `Not Found` as `NOT_FOUND`, `Unsupported Media Type` as `UNSUPPORTED_MEDIA_TYPE`: the code of the pipeline for that status. */
function codeOfTitle(title: string): string {
  return title.toUpperCase().replaceAll(' ', '_');
}
