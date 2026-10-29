import { describe, expect, it } from 'vitest';
import { answeredEdgeError } from '../src/error/answered-edge-error';
import { codeOfStatus } from '../src/error/code-of-status';
import { DEFAULT_ERROR_MAPPING } from '../src/error/default-error-mapping';
import { STATUSES } from '../src/error/statuses';

/** An error a middleware raises with a status of its own, as http-errors and the frameworks build them. */
function raised(fields: Readonly<Record<string, unknown>>): Error {
  return Object.assign(new Error('a message that never reaches the answer'), fields);
}

const answered = (error: unknown) => answeredEdgeError({ error, headers: { 'x-request-id': 'req-1' } }, {});

describe('the code of a refusal at the edge', () => {
  it.each([
    [401, 'Unauthorized', 'UNAUTHORIZED'],
    [404, 'Not Found', 'NOT_FOUND'],
    [405, 'Method Not Allowed', 'METHOD_NOT_ALLOWED'],
    [415, 'Unsupported Media Type', 'UNSUPPORTED_MEDIA_TYPE'],
    [422, 'Unprocessable Content', 'VALIDATION_FAILED'],
    [429, 'Too Many Requests', 'RATE_LIMITED'],
  ])('is the code of the kit for %i, as the pipeline answers it', (status, title, code) => {
    expect(answered(raised({ status })).problem).toEqual({
      type: 'about:blank',
      title,
      status,
      code,
      requestId: 'req-1',
    });
  });

  it('is the fallback of the table for a client status the table does not name', () => {
    expect(answered(raised({ statusCode: 418 })).problem).toMatchObject({
      status: 418,
      title: 'Client Error',
      code: 'BAD_REQUEST',
    });
  });
});

describe('the table of the statuses', () => {
  it('gives each status the code the default mapping answers with that status', () => {
    for (const [status, { code }] of Object.entries(STATUSES)) {
      const mapped = DEFAULT_ERROR_MAPPING[code];

      expect(mapped === undefined || mapped === Number(status), `${status} ${code}`).toBe(true);
    }
  });

  it('falls back on a bad request below 500 and an internal error from 500', () => {
    expect([codeOfStatus(499), codeOfStatus(599)]).toEqual(['BAD_REQUEST', 'INTERNAL_ERROR']);
  });
});

describe('a failure at the edge that carries a server status', () => {
  it.each([
    [502, 'Bad Gateway', 'BAD_GATEWAY'],
    [503, 'Service Unavailable', 'SERVICE_UNAVAILABLE'],
    [504, 'Gateway Timeout', 'GATEWAY_TIMEOUT'],
    [599, 'Server Error', 'INTERNAL_ERROR'],
  ])('keeps %i, its code from the table and nothing of its message', (status, title, code) => {
    expect(answered(raised({ status })).problem).toEqual({
      type: 'about:blank',
      title,
      status,
      code,
      requestId: 'req-1',
    });
  });

  it.each([[{}], [{ status: 600 }], [{ status: 503.5 }], [{ status: '503' }], [{ statusCode: 302 }]])(
    'is a 500 when the status it carries is not one of a failure (%j)',
    (fields) => {
      expect(answered(raised(fields)).problem).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
    },
  );
});

describe('the headers of a refusal at the edge', () => {
  const challenge = 'Bearer realm="orders"';

  it('keep those the error carries, as http-errors and Fastify give them, under the headers of the problem', () => {
    const error = raised({
      status: 401,
      headers: {
        'WWW-Authenticate': challenge,
        'Retry-After': 30,
        'Content-Type': 'text/html',
        'X-Request-Id': 'other',
      },
    });

    expect(answered(error).headers).toEqual({
      'www-authenticate': challenge,
      'retry-after': '30',
      'content-type': 'application/problem+json; charset=utf-8',
      'x-request-id': 'req-1',
      'x-correlation-id': 'req-1',
    });
  });

  it('keep those of the response a Hono HTTPException carries, not its length nor its media type', () => {
    const res = new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': challenge, 'Content-Length': '12' },
    });

    expect(answered(raised({ status: 401, res })).headers).toMatchObject({
      'www-authenticate': challenge,
      'content-type': 'application/problem+json; charset=utf-8',
    });

    expect(answered(raised({ status: 401, res })).headers).not.toHaveProperty('content-length');
  });

  it('leave out a header no response could write, and every header of an error without a status', () => {
    const headers = { 'Bad Name': 'x', Allow: 'GET\r\nSet-Cookie: a=b', Vary: ['Accept'], Link: '</next>' };

    expect(Object.keys(answered(raised({ status: 405, headers })).headers)).toEqual([
      'link',
      'content-type',
      'x-request-id',
      'x-correlation-id',
    ]);

    expect(answered(raised({ headers: { 'Retry-After': '30' } })).headers).not.toHaveProperty('retry-after');
  });
});

describe('an empty body in JSON that Fastify refuses out of the routes of the kit', () => {
  it('is a bad request, not a body that is not JSON: an empty body is absent', () => {
    const error = raised({ code: 'FST_ERR_CTP_EMPTY_JSON_BODY', statusCode: 400 });

    expect(answered(error).problem).toMatchObject({ status: 400, code: 'BAD_REQUEST' });
    expect(answered(error).problem).not.toHaveProperty('detail');
  });
});
