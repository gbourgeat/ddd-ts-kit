import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { expectVersion } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  CacheScope,
  IfMatch,
  defineRoute,
  executeRoute,
  type CachePolicy,
  type RawHeaders,
  type RawRequest,
  type Route,
} from '../src/index.js';
import { generateOpenApi } from '../src/openapi.js';

const calendarShape = z.object({ id: z.string(), version: z.number(), changedAt: z.string() });
const calendar = zodSchema(calendarShape);

const request = (headers: RawHeaders = {}, body?: unknown): RawRequest => ({
  params: { calendarId: 'calendar-1' },
  query: {},
  headers,
  body,
  raw: null,
});

const SEVENTH = { id: 'calendar-1', version: 7, changedAt: '2026-03-02T09:00:00.000Z' };

function readCalendar(cache: CachePolicy, answered: z.infer<typeof calendarShape> = SEVENTH): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/calendars/:calendarId',
      operationId: 'readCalendar',
      summary: 'Read a calendar',
      responses: { 200: { description: 'The calendar.', body: calendar } },
      security: false,
      cache,
    },
    () => ({ status: 200, body: answered }),
  );
}

const versioned = readCalendar({ scope: CacheScope.public, maxAge: '1m', etag: { version: 'version' } });
const hashed = readCalendar({ scope: CacheScope.private, maxAge: '0s', etag: 'representation' });
const dated = readCalendar({ scope: CacheScope.public, maxAge: '1m', lastModified: 'changedAt' });

function renameCalendar(ifMatch: IfMatch, version = 7): Route {
  return defineRoute(
    {
      method: 'PUT',
      path: '/calendars/:calendarId/name',
      operationId: 'renameCalendar',
      summary: 'Rename a calendar',
      responses: {
        200: {
          description: 'The version the change was made on.',
          body: zodSchema(z.object({ on: z.number().optional() })),
        },
      },
      security: false,
      ifMatch,
    },
    ({ context }) => {
      expectVersion({ id: 'calendar-1', version }, context.expectedVersion);

      return { status: 200, body: context.expectedVersion === undefined ? {} : { on: context.expectedVersion } };
    },
  );
}

describe('a read that names its version', () => {
  it('answers a weak ETag made of the version its body carries', async () => {
    const response = await executeRoute(versioned, request());

    expect(response.headers['etag']).toBe('W/"7"');
    expect(response.headers['cache-control']).toBe('public, max-age=60');
  });

  it('answers 304 without a body when the caller holds that version, in either form or among others', async () => {
    for (const held of ['W/"7"', '"7"', 'W/"6", W/"7"', '*']) {
      const response = await executeRoute(versioned, request({ 'if-none-match': held }));

      expect(response).toEqual({
        status: 304,
        headers: expect.objectContaining({ etag: 'W/"7"', 'cache-control': 'public, max-age=60' }),
      });

      expect(response.headers['content-type']).toBeUndefined();
    }
  });

  it('answers the whole representation when the caller holds another version', async () => {
    const response = await executeRoute(versioned, request({ 'if-none-match': 'W/"6"' }));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ version: 7 });
  });

  it('answers a strong ETag hashed from the bytes it sends, the same for the same bytes only', async () => {
    const first = await executeRoute(hashed, request());
    const again = await executeRoute(hashed, request());

    const changed = await executeRoute(
      readCalendar(
        { scope: CacheScope.private, maxAge: '0s', etag: 'representation' },
        { id: 'calendar-1', version: 8, changedAt: '2026-03-02T09:00:00.000Z' },
      ),
      request(),
    );

    expect(first.headers['etag']).toMatch(/^"[A-Za-z0-9_-]{43}"$/);
    expect(again.headers['etag']).toBe(first.headers['etag']);
    expect(changed.headers['etag']).not.toBe(first.headers['etag']);
    expect((await executeRoute(hashed, request({ 'if-none-match': first.headers['etag'] }))).status).toBe(304);
  });

  it('answers Last-Modified, and 304 to a caller that holds it, to the second', async () => {
    const response = await executeRoute(dated, request());

    expect(response.headers['last-modified']).toBe('Mon, 02 Mar 2026 09:00:00 GMT');

    expect((await executeRoute(dated, request({ 'if-modified-since': 'Mon, 02 Mar 2026 09:00:00 GMT' }))).status).toBe(
      304,
    );

    expect((await executeRoute(dated, request({ 'if-modified-since': 'Mon, 02 Mar 2026 08:59:59 GMT' }))).status).toBe(
      200,
    );

    expect((await executeRoute(dated, request({ 'if-modified-since': 'yesterday' }))).status).toBe(200);
  });

  it('reads If-None-Match before If-Modified-Since', async () => {
    const both = readCalendar({
      scope: CacheScope.public,
      maxAge: '1m',
      etag: { version: 'version' },
      lastModified: 'changedAt',
    });

    const response = await executeRoute(
      both,
      request({ 'if-none-match': 'W/"6"', 'if-modified-since': 'Mon, 02 Mar 2026 10:00:00 GMT' }),
    );

    expect(response.status).toBe(200);
  });

  it('is a server fault when its body carries no version or no instant where it said', async () => {
    const noVersion = readCalendar({ scope: CacheScope.public, maxAge: '1m', etag: { version: 'revision' } });
    const noInstant = readCalendar({ scope: CacheScope.public, maxAge: '1m', lastModified: 'id' });

    expect((await executeRoute(noVersion, request())).status).toBe(500);
    expect((await executeRoute(noInstant, request())).status).toBe(500);
  });

  it('documents its validators, the conditional headers it reads and its 304 in the contract', () => {
    const both = readCalendar({
      scope: CacheScope.public,
      maxAge: '1m',
      etag: { version: 'version' },
      lastModified: 'changedAt',
    });

    const operation = generateOpenApi({ info: { title: 'Calendars', version: '1' }, routes: [both] }).paths[
      '/calendars/{calendarId}'
    ]?.['get'];

    expect(operation?.['parameters']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'If-None-Match', in: 'header', required: false }),
        expect.objectContaining({ name: 'If-Modified-Since', in: 'header', required: false }),
      ]),
    );

    expect(operation?.['responses']).toMatchObject({
      '200': { headers: { ETag: { schema: { type: 'string' } }, 'Last-Modified': { schema: { type: 'string' } } } },
      '304': { description: expect.stringContaining('Not Modified') },
    });
  });
});

describe('a write conditional on the version the caller read', () => {
  it('hands the version named in If-Match to the handler, in its weak or strong form', async () => {
    expect((await executeRoute(renameCalendar(IfMatch.optional), request({ 'if-match': 'W/"7"' }))).body).toEqual({
      on: 7,
    });

    expect((await executeRoute(renameCalendar(IfMatch.optional), request({ 'if-match': '"7"' }))).body).toEqual({
      on: 7,
    });
  });

  it('runs unconditionally without If-Match, or with *, when it is optional', async () => {
    expect((await executeRoute(renameCalendar(IfMatch.optional), request())).body).toEqual({});
    expect((await executeRoute(renameCalendar(IfMatch.optional), request({ 'if-match': '*' }))).body).toEqual({});
  });

  it('answers 412 when the element changed since the caller read it, and when the tag names no version', async () => {
    const stale = await executeRoute(renameCalendar(IfMatch.optional, 8), request({ 'if-match': 'W/"7"' }));
    const unreadable = await executeRoute(renameCalendar(IfMatch.optional), request({ 'if-match': '"a1b2"' }));

    expect(stale.status).toBe(412);
    expect(stale.body).toMatchObject({ code: 'PRECONDITION_FAILED', title: 'Precondition Failed' });
    expect(unreadable.status).toBe(412);
  });

  it('answers 428 without If-Match when it is required', async () => {
    const response = await executeRoute(renameCalendar(IfMatch.required), request());

    expect(response.status).toBe(428);
    expect(response.body).toMatchObject({ code: 'PRECONDITION_REQUIRED' });
  });

  it('documents If-Match and the problems it may answer in the contract', () => {
    const operation = generateOpenApi({
      info: { title: 'Calendars', version: '1' },
      routes: [renameCalendar(IfMatch.required)],
    }).paths['/calendars/{calendarId}/name']?.['put'];

    expect(operation?.['parameters']).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'If-Match', in: 'header', required: true })]),
    );

    expect(operation?.['responses']).toMatchObject({
      '412': { 'x-error-codes': ['PRECONDITION_FAILED'] },
      '428': { 'x-error-codes': ['PRECONDITION_REQUIRED'] },
    });
  });
});

describe('a conditional declaration that cannot stand', () => {
  const declare = (method: 'GET' | 'PUT', extra: Partial<Pick<Route, 'cache' | 'ifMatch'>>) => (): Route =>
    defineRoute(
      {
        method,
        path: '/calendars',
        operationId: 'touchCalendars',
        summary: 'Touch the calendars',
        responses: { 200: { description: 'Done.' } },
        security: false,
        ...extra,
      },
      () => ({ status: 200 }),
    );

  it('is refused when a read declares If-Match, or a write declares the validators of a read', () => {
    expect(declare('GET', { ifMatch: IfMatch.required })).toThrow(/a read changes nothing/);

    expect(declare('PUT', { cache: { scope: CacheScope.noStore, etag: 'representation' } })).toThrow(
      /a write names the version it changes with ifMatch/,
    );
  });
});
