import { correlationIdOf } from '../pipeline/correlation-id-of';
import { CORRELATION_HEADER } from '../pipeline/correlation-header';
import { PROBLEM_CONTENT_TYPE } from '../pipeline/problem-content-type';
import { wellFormedIdentifier } from '../pipeline/well-formed-identifier';
import type { RawHeaders } from '../route/raw-headers';
import type { EdgeRefusal } from './edge-refusal';
import type { Problem } from './problem';

/** What a request refused before the pipeline receives: a problem document, as every other refusal. */
export interface EdgeAnswer {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly problem: Problem;
}

/** The problem of the refusal, with the identifiers of the request the pipeline would have given it. */
export function edgeAnswer(headers: Readonly<RawHeaders>, refusal: EdgeRefusal): EdgeAnswer {
  const requestId = wellFormedIdentifier(headers['x-request-id']) ?? globalThis.crypto.randomUUID();

  return {
    status: refusal.status,
    headers: {
      'content-type': PROBLEM_CONTENT_TYPE,
      'x-request-id': requestId,
      [CORRELATION_HEADER]: correlationIdOf(headers, requestId),
    },
    problem: { type: 'about:blank', ...refusal, requestId },
  };
}
