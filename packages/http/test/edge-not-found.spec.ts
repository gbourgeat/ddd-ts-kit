import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryLogger } from '@ddd-ts-kit/kernel';
import { nestOver, type Start, startExpress, startFastify, startHono } from './support/edge-servers';
import type { RunningServer } from './support/running-server';

const PROBLEM = 'application/problem+json; charset=utf-8';

let running: RunningServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

async function started(start: Start, logger: InMemoryLogger): Promise<string> {
  running = await start(logger);

  return running.url;
}

describe.each([
  ['Express', startExpress, 'NOT_FOUND'],
  ['Fastify', startFastify, 'NOT_FOUND'],
  ['Hono', startHono, 'NOT_FOUND'],
  // Nest answers the path with a NotFoundException of its own, which its filter reads.
  ['Nest over Express', nestOver('express'), 'NotFoundException'],
  ['Nest over Fastify', nestOver('fastify'), 'NotFoundException'],
] as const)('a path no route serves on %s', (_name, start, errorType) => {
  it('is answered 404 NOT_FOUND as a problem, with the identifiers of the request, and logged at info, not as a warning', async () => {
    const logger = new InMemoryLogger();
    const response = await fetch(`${await started(start, logger)}/nowhere`, { headers: { 'x-request-id': 'req-1' } });

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe(PROBLEM);
    expect(response.headers.get('x-request-id')).toBe('req-1');

    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
      requestId: 'req-1',
    });

    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'request refused before its route',
        fields: { errorType, status: 404, requestId: 'req-1' },
      },
    ]);
  });
});
