import { CORRELATION_HEADER } from '../pipeline/correlation-header.js';
import { wellFormedIdentifier } from '../pipeline/well-formed-identifier.js';
import type { RawHeaders } from '../route/raw-headers.js';

const BAD_REQUEST = 400;

/** The answer to a body that is not JSON, before the pipeline runs: a problem document, as every other refusal. */
export function malformedBody(headers: RawHeaders): Response {
  const requestId = wellFormedIdentifier(headers['x-request-id']) ?? globalThis.crypto.randomUUID();

  const problem = {
    type: 'about:blank',
    title: 'Bad Request',
    status: BAD_REQUEST,
    code: 'MALFORMED_BODY',
    detail: 'The body is not valid JSON.',
    requestId,
  };

  return new Response(JSON.stringify(problem), {
    status: BAD_REQUEST,
    headers: {
      'content-type': 'application/problem+json',
      [CORRELATION_HEADER]: wellFormedIdentifier(headers[CORRELATION_HEADER]) ?? requestId,
    },
  });
}
