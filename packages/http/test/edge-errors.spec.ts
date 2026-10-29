import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import express, { type NextFunction, type Request, type Response } from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryLogger } from '@ddd-ts-kit/kernel';
import { mountExpress, problemErrorHandler as expressErrorHandler } from '../src/express';
import { mountFastify, problemErrorHandler as fastifyErrorHandler } from '../src/fastify';
import { mountHono, problemErrorHandler as honoErrorHandler } from '../src/hono';
import { createRoutesModule, ProblemExceptionFilter } from '../src/nest';
import { orderRoutes, SECRET } from './support/orders';
import type { RunningServer } from './support/running-server';

/** A body that is not JSON and quotes an address: what must reach neither the answer nor the log. */
const MALFORMED = '{"customerId":"jane@example.com",bad';
const PERSONAL = 'jane@example.com';
const PROBLEM = 'application/problem+json; charset=utf-8';

type Start = (logger: InMemoryLogger | undefined) => Promise<RunningServer>;

/** A middleware in front of the routes that fails, as the limit of each caller does when its store does. */
function failing(_request: Request, _response: Response, next: NextFunction): void {
  next(new Error(SECRET));
}

const startExpress: Start = async (logger) => {
  const app = express();

  app.use('/failing', failing);
  app.use(express.json());
  mountExpress(app, orderRoutes);
  app.use(expressErrorHandler(logger === undefined ? {} : { logger }));

  return listening(app.listen(0, '127.0.0.1'));
};

const startFastify: Start = async (logger) => {
  const app = Fastify({ bodyLimit: 1024 });

  app.setErrorHandler(fastifyErrorHandler(logger === undefined ? {} : { logger }));

  app.addHook('onRequest', async (request) => {
    if (request.url === '/failing') {
      throw new Error(SECRET);
    }
  });

  mountFastify(app, orderRoutes);

  const url = await app.listen({ port: 0, host: '127.0.0.1' });

  return { url, close: () => app.close() };
};

const startHono: Start = async (logger) => {
  const app = new Hono();

  app.onError(honoErrorHandler(logger === undefined ? {} : { logger }));

  app.use('/failing', () => {
    throw new Error(SECRET);
  });

  mountHono(app, orderRoutes, { bodyLimit: 1024 });

  return listening(serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }));
};

function nestOver(platform: 'express' | 'fastify'): Start {
  return async (logger) => {
    const module = createRoutesModule(orderRoutes);

    const app =
      platform === 'express'
        ? await NestFactory.create(module, { logger: false, abortOnError: false, rawBody: true })
        : await NestFactory.create(module, new FastifyAdapter({ bodyLimit: 1024 }), {
            logger: false,
            abortOnError: false,
          });

    app.useGlobalFilters(new ProblemExceptionFilter(app.getHttpAdapter(), logger === undefined ? {} : { logger }));

    app.use('/failing', failing);
    await app.listen(0, '127.0.0.1');

    return { url: await app.getUrl(), close: () => app.close() };
  };
}

interface Listening {
  once(event: 'listening', listener: () => void): unknown;
  address(): AddressInfo | string | null;
  close(callback: () => void): unknown;
}

async function listening(server: Listening): Promise<RunningServer> {
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

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
  ['Express', startExpress, 'entity.parse.failed', 'MALFORMED_BODY', 'The body is not valid JSON.'],
  ['Fastify', startFastify, 'FST_ERR_CTP_INVALID_JSON_BODY', 'MALFORMED_BODY', 'The body is not valid JSON.'],
  // Nest turns the error of the parser into an HttpException of its own before any filter sees it.
  ['Nest over Express', nestOver('express'), 'BadRequestException', 'BAD_REQUEST', undefined],
  ['Nest over Fastify', nestOver('fastify'), 'HttpException', 'BAD_REQUEST', undefined],
] as const)('a body %s cannot read as JSON', (_name, start, errorType, code, detail) => {
  it('is answered 400 as a problem, with the identifiers of the request', async () => {
    const response = await postOrder(await started(start, new InMemoryLogger()), MALFORMED);

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe(PROBLEM);
    expect(response.headers.get('x-request-id')).toBe('req-1');
    expect(response.headers.get('x-correlation-id')).toBe('flow-1');

    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code,
      ...(detail === undefined ? {} : { detail }),
      requestId: 'req-1',
    });
  });

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
