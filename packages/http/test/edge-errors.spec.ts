import 'reflect-metadata';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryLogger } from '@ddd-ts-kit/kernel';
import { problemErrorHandler as expressErrorHandler } from '../src/express';
import {
  CHALLENGE,
  listening,
  nestOver,
  type Start,
  startExpress,
  startFastify,
  startHono,
} from './support/edge-servers';
import { SECRET } from './support/orders';
import type { RunningServer } from './support/running-server';

/** A body that is not JSON and quotes an address: what must reach neither the answer nor the log. */
const MALFORMED = '{"customerId":"jane@example.com",bad';
const PERSONAL = 'jane@example.com';
const PROBLEM = 'application/problem+json; charset=utf-8';

let running: RunningServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

async function started(start: Start, logger?: InMemoryLogger): Promise<string> {
  running = await start(logger);

  return running.url;
}

function postOrder(url: string, body: string): Promise<globalThis.Response> {
  return fetch(`${url}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': 'req-1', 'x-correlation-id': 'flow-1' },
    body,
  });
}

/** What every entry written for the refusal holds: its type, its status and the request, nothing of the body. */
function written(logger: InMemoryLogger): string {
  return JSON.stringify(logger.entries);
}

describe.each([
  ['Express', startExpress],
  ['Fastify', startFastify],
  ['Hono', startHono],
  ['Nest over Express', nestOver('express')],
  ['Nest over Fastify', nestOver('fastify')],
] as const)('an empty body in JSON on %s', (_name, start) => {
  it('reaches the route as an absent body', async () => {
    const response = await fetch(`${await started(start)}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ absent: true });
  });

  it('is refused by the validation of a route that requires a body', async () => {
    const response = await postOrder(await started(start), '');

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED', issues: [{ path: 'body' }] });
  });
});

describe.each([
  ['Express', startExpress],
  ['Fastify', startFastify],
  ['Hono', startHono],
  ['Nest over Express', nestOver('express')],
  ['Nest over Fastify', nestOver('fastify')],
] as const)('a body %s cannot read as JSON', (_name, start) => {
  it('is answered 400 MALFORMED_BODY as a problem, with the identifiers of the request', async () => {
    const response = await postOrder(await started(start, new InMemoryLogger()), MALFORMED);

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe(PROBLEM);
    expect(response.headers.get('x-request-id')).toBe('req-1');
    expect(response.headers.get('x-correlation-id')).toBe('flow-1');

    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'MALFORMED_BODY',
      detail: 'The body is not valid JSON.',
      requestId: 'req-1',
    });
  });
});

// Hono reads the body in the route of the kit, which answers it: nothing reaches the error handler to log.
describe.each([
  ['Express', startExpress, 'entity.parse.failed'],
  ['Fastify', startFastify, 'FST_ERR_CTP_INVALID_JSON_BODY'],
  // Nest turns the error of the parser into an HttpException of its own before any filter sees it.
  ['Nest over Express', nestOver('express'), 'BadRequestException'],
  ['Nest over Fastify', nestOver('fastify'), 'HttpException'],
] as const)('a body %s refuses before its route', (_name, start, errorType) => {
  it('is logged by its type and its status, never by what the body holds', async () => {
    const logger = new InMemoryLogger();
    const response = await postOrder(await started(start, logger), MALFORMED);

    expect(await response.text()).not.toContain(PERSONAL);

    expect(logger.entries).toEqual([
      {
        level: 'warn',
        message: 'request refused before its route',
        fields: { errorType, status: 400, requestId: 'req-1' },
      },
    ]);

    expect(written(logger)).not.toContain(PERSONAL);
  });
});

describe.each([
  ['Express', startExpress, 'entity.too.large', 'The body is larger than 102400 bytes.'],
  ['Fastify', startFastify, 'FST_ERR_CTP_BODY_TOO_LARGE', 'The body is larger than what the server reads.'],
  ['Nest over Express', nestOver('express'), 'entity.too.large', 'The body is larger than 102400 bytes.'],
  ['Nest over Fastify', nestOver('fastify'), 'HttpException', 'The body is larger than what the server reads.'],
] as const)('a body larger than %s reads', (_name, start, errorType, detail) => {
  it('is answered 413 as a problem, and logged by its type and its status', async () => {
    const logger = new InMemoryLogger();
    const body = JSON.stringify({ customerId: PERSONAL, note: 'x'.repeat(200_000) });
    const response = await postOrder(await started(start, logger), body);

    expect(response.status).toBe(413);
    expect(response.headers.get('content-type')).toBe(PROBLEM);

    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Content Too Large',
      status: 413,
      code: 'BODY_TOO_LARGE',
      detail,
      requestId: 'req-1',
    });

    expect(logger.entries).toEqual([
      {
        level: 'warn',
        message: 'request refused before its route',
        fields: { errorType, status: 413, requestId: 'req-1' },
      },
    ]);
  });
});

describe.each([
  ['Express', startExpress],
  ['Fastify', startFastify],
  ['Hono', startHono],
  ['Nest over Express', nestOver('express')],
  ['Nest over Fastify', nestOver('fastify')],
] as const)('a middleware in front of the routes of %s that fails', (_name, start) => {
  it('is answered 500 as a problem that says nothing of the failure, and logged as an error', async () => {
    const logger = new InMemoryLogger();
    const response = await fetch(`${await started(start, logger)}/failing`, { headers: { 'x-request-id': 'req-2' } });

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toBe(PROBLEM);

    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
      requestId: 'req-2',
    });

    expect(logger.entries).toEqual([
      {
        level: 'error',
        message: 'request failed before its route',
        fields: { errorType: 'Error', status: 500, requestId: 'req-2' },
      },
    ]);

    expect(written(logger)).not.toContain('hunter2');
  });

  it('is answered the same with no logger, a request id of its own given', async () => {
    const response = await fetch(`${await started(start)}/failing`);
    const problem: unknown = await response.json();

    expect(response.status).toBe(500);
    expect(problem).toMatchObject({ code: 'INTERNAL_ERROR', requestId: expect.any(String) });
    expect(response.headers.get('x-request-id')).toBe((problem as { requestId: string }).requestId);
  });
});

describe.each([
  ['Express', startExpress],
  ['Fastify', startFastify],
  ['Hono', startHono],
  ['Nest over Express', nestOver('express')],
  ['Nest over Fastify', nestOver('fastify')],
] as const)('a middleware in front of the routes of %s that fails with a server status', (_name, start) => {
  it('keeps the status, answered with the code of the kit and nothing of the failure, and logged as an error', async () => {
    const logger = new InMemoryLogger();

    const response = await fetch(`${await started(start, logger)}/unavailable`, {
      headers: { 'x-request-id': 'req-3' },
    });

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toBe(PROBLEM);

    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      requestId: 'req-3',
    });

    expect(logger.entries).toEqual([
      {
        level: 'error',
        message: 'request failed before its route',
        fields: { errorType: 'Error', status: 503, requestId: 'req-3' },
      },
    ]);
  });
});

describe.each([
  ['Express', startExpress],
  ['Fastify', startFastify],
  ['Hono', startHono],
  ['Nest over Express', nestOver('express')],
  ['Nest over Fastify', nestOver('fastify')],
] as const)('a middleware in front of the routes of %s that refuses with headers of its own', (_name, start) => {
  it('is answered as a problem that keeps them, a 401 with its challenge', async () => {
    const response = await fetch(`${await started(start)}/unauthenticated`, { headers: { 'x-request-id': 'req-4' } });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(CHALLENGE);
    expect(response.headers.get('content-type')).toBe(PROBLEM);
    expect(response.headers.get('x-request-id')).toBe('req-4');
    expect(await response.json()).toMatchObject({ title: 'Unauthorized', status: 401, code: 'UNAUTHORIZED' });
  });
});

describe.each([
  ['Express', startExpress],
  ['Fastify', startFastify],
  ['Hono', startHono],
  ['Nest over Express', nestOver('express')],
  ['Nest over Fastify', nestOver('fastify')],
] as const)('a tenant refusal below the edge of %s', (_name, start) => {
  it.each([
    ['/no-tenant', 403, 'FORBIDDEN'],
    ['/invalid-tenant', 404, 'NOT_FOUND'],
    ['/foreign-stream', 404, 'NOT_FOUND'],
  ])('answers %s with what it means', async (path, status, code) => {
    const response = await fetch(`${await started(start)}${path}`);
    const problem: unknown = await response.json();

    expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toBe(PROBLEM);
    expect(problem).toMatchObject({ status, code });
  });

  it('says nothing of the stream, of the tenant it belongs to or of the id it was given', async () => {
    const url = await started(start);
    const foreign = await (await fetch(`${url}/foreign-stream`)).text();
    const invalid = await (await fetch(`${url}/invalid-tenant`)).text();

    expect(foreign).not.toContain('billing.invoice-1');
    expect(foreign).not.toContain('tenant');
    expect(invalid).not.toContain('*');
  });
});

describe('a refusal of the framework that carries a client status', () => {
  it('keeps its status on Fastify, a body in a media type no parser reads answered 415', async () => {
    const response = await fetch(`${await started(startFastify)}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-unknown' },
      body: 'x',
    });

    expect(response.status).toBe(415);

    expect(await response.json()).toMatchObject({
      title: 'Unsupported Media Type',
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('keeps its status on Nest, a path no route serves answered 404', async () => {
    const response = await fetch(`${await started(nestOver('express'))}/nowhere`);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: 'Not Found', status: 404, code: 'NOT_FOUND' });
  });
});

describe('an error once the answer has started', () => {
  it('cuts the response short on Express: no problem can follow a status already sent', async () => {
    const app = express();

    app.get('/started', (_request, response, next) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write('partial');
      next(new Error(SECRET));
    });

    app.use(expressErrorHandler());
    running = await listening(app.listen(0, '127.0.0.1'));

    await expect(fetch(`${running.url}/started`).then((response) => response.text())).rejects.toThrow();
  });
});
