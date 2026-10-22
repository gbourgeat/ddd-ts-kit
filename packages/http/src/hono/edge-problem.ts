import { CORRELATION_HEADER } from '../pipeline/correlation-header';
import { wellFormedIdentifier } from '../pipeline/well-formed-identifier';
import type { RawHeaders } from '../route/raw-headers';

/** A request the adapter refuses before the pipeline runs: its status, its code and what is wrong. */
export interface EdgeRefusal {
  readonly status: number;
  readonly title: string;
  readonly code: string;
  readonly detail: string;
}

/** The answer to a request refused at the edge: a problem document, as every other refusal. */
export function edgeProblem(headers: RawHeaders, refusal: EdgeRefusal): Response {
  const requestId = wellFormedIdentifier(headers['x-request-id']) ?? globalThis.crypto.randomUUID();
  const problem = { type: 'about:blank', ...refusal, requestId };

  return new Response(JSON.stringify(problem), {
    status: refusal.status,
    headers: {
      'content-type': 'application/problem+json',
      [CORRELATION_HEADER]: wellFormedIdentifier(headers[CORRELATION_HEADER]) ?? requestId,
    },
  });
}
