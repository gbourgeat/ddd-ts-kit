import express from 'express';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { sharedSchema } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  CacheScope,
  CacheTagHeader,
  Representations,
  defineRoute,
  executeRoute,
  formRoutes,
  pageSchemaOf,
  withFieldAccess,
  type CachePolicy,
  type ExecuteOptions,
  type RawHeaders,
  type RawRequest,
  type Route,
} from '../src';
import { mountExpress } from '../src/express';
import { generateOpenApi } from '../src/openapi';

const representations = Representations.standard();

const calendarShape = z.object({ id: z.string(), version: z.number(), changedAt: z.string() });
const SEVENTH = { id: 'calendar-1', version: 7, changedAt: '2026-03-02T09:00:00.000Z' };

const request = (headers: RawHeaders = {}): RawRequest => ({
  params: { calendarId: 'calendar-1' },
  query: {},
  headers,
  body: undefined,
  raw: null,
});

function readCalendar(cache: CachePolicy, produces: readonly string[] = ['application/xml']): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/calendars/:calendarId',
      operationId: 'readCalendar',
      summary: 'Read a calendar',
      responses: { 200: { description: 'The calendar.', body: zodSchema(calendarShape) } },
      security: false,
      produces,
      cache,
    },
    () => ({ status: 200, body: SEVENTH }),
  );
}

const described = readCalendar({
  scope: CacheScope.public,
  maxAge: '1m',
  vary: ['Accept-Language'],
  etag: { version: 'version' },
  lastModified: 'changedAt',
  tags: [{ resource: 'calendar', field: 'id' }],
});

const hashed = readCalendar({ scope: CacheScope.private, maxAge: '0s', etag: 'representation' });

const tagged: ExecuteOptions = { representations, cacheTags: { header: CacheTagHeader.xkey } };

describe('a cached answer written in another media type', () => {
  it('varies on the headers of its policy and on Accept', async () => {
    const response = await executeRoute(described, request({ accept: 'application/xml' }), tagged);

    expect(response.headers['content-type']).toBe('application/xml; charset=utf-8');
    expect(response.headers['vary']).toBe('Accept-Language, accept');
    expect(response.headers['cache-control']).toBe('public, max-age=60');
  });

  it('reads its version, its instant and its tags from what the handler answered, not from the bytes', async () => {
    const response = await executeRoute(described, request({ accept: 'application/xml' }), tagged);

    expect(response.headers['etag']).toBe('W/"7"');
    expect(response.headers['last-modified']).toBe('Mon, 02 Mar 2026 09:00:00 GMT');
    expect(response.headers['xkey']).toBe('calendar:calendar-1');
  });

  it('answers 304 to a caller that holds the version, whatever the media type', async () => {
    const response = await executeRoute(
      described,
      request({ accept: 'application/xml', 'if-none-match': 'W/"7"' }),
      tagged,
    );

    expect(response.status).toBe(304);
    expect(response).not.toHaveProperty('body');
  });

  it('gives each representation a strong ETag of its own bytes', async () => {
    const json = await executeRoute(hashed, request({ accept: 'application/json' }), { representations });
    const xml = await executeRoute(hashed, request({ accept: 'application/xml' }), { representations });

    expect(json.headers['etag']).toMatch(/^"[\w-]+"$/);
    expect(xml.headers['etag']).toMatch(/^"[\w-]+"$/);
    expect(xml.headers['etag']).not.toBe(json.headers['etag']);
  });

  it('documents Vary with Accept in the contract, next to the headers of its policy', () => {
    const document = generateOpenApi({
      info: { title: 'Calendars', version: '1' },
      routes: [described],
      representations,
    });

    expect(JSON.stringify(document)).toContain('"const":"Accept-Language, accept"');
  });
});

describe('a public answer chosen by Accept', () => {
  const shared = readCalendar({ scope: CacheScope.public, maxAge: '1m' });
  const jsonOnly = readCalendar({ scope: CacheScope.public, maxAge: '1m' }, []);

  it('is refused behind a cache that ignores Vary, which would hand one media type to every caller', () => {
    const options = { representations, cacheTags: { header: CacheTagHeader.cacheTag } };

    expect(() => mountExpress(express(), [shared], options)).toThrow(DeclarationError);
    expect(() => mountExpress(express(), [shared], options)).toThrow(/ignores Vary/);
  });

  it('is accepted behind a cache that keys on Vary, and when it answers JSON only', () => {
    const ignoringVary = { representations, cacheTags: { header: CacheTagHeader.cacheTag } };

    expect(() => mountExpress(express(), [shared], tagged)).not.toThrow();
    expect(() => mountExpress(express(), [jsonOnly], ignoringVary)).not.toThrow();
  });
});

describe('a public answer whose fields depend on who calls', () => {
  const noteShape = z.object({ id: z.string(), note: z.string() });

  function readNote(cache: CachePolicy, rule: Parameters<typeof withFieldAccess>[1]): Route {
    return defineRoute(
      {
        method: 'GET',
        path: '/notes/:noteId',
        operationId: 'readNote',
        summary: 'Read a note',
        responses: { 200: { description: 'The note.', body: withFieldAccess(zodSchema(noteShape), rule) } },
        security: false,
        cache,
      },
      () => ({ status: 200, body: { id: 'n1', note: 'fragile' } }),
    );
  }

  const readable = { note: { read: { permission: { id: 'care:note.read' } } } };

  it('is refused when a shared cache would hand the answer of one caller to the next', () => {
    const route = readNote({ scope: CacheScope.public, maxAge: '1m', vary: ['Accept-Language'] }, readable);

    expect(() => mountExpress(express(), [route], tagged)).toThrow(DeclarationError);
    expect(() => mountExpress(express(), [route], tagged)).toThrow(/some fields to some callers only/);
  });

  it('is accepted when it varies on who calls, when it is private, or when only writing is restricted', () => {
    const varying = readNote({ scope: CacheScope.public, maxAge: '1m', vary: ['Authorization'] }, readable);
    const kept = readNote({ scope: CacheScope.private, maxAge: '1m' }, readable);

    const writing = readNote(
      { scope: CacheScope.public, maxAge: '1m' },
      { note: { write: { permission: { id: 'care:note.write' } } } },
    );

    for (const route of [varying, kept, writing]) {
      expect(() => mountExpress(express(), [route], tagged)).not.toThrow();
    }
  });
});

describe('fields reserved to some callers in a shared schema', () => {
  const noteShape = z.object({ id: z.string(), note: z.string() });
  const reserved = { note: { read: { permission: { id: 'care:note.read' } } } };

  it('are marked in the definition the shared schema refers to', () => {
    const note = withFieldAccess(sharedSchema('Note', zodSchema(noteShape)), reserved);
    const definition = z.object({ properties: z.object({ note: z.record(z.string(), z.unknown()) }) });
    const { $defs } = z.object({ $defs: z.object({ Note: definition }) }).parse(note.toJsonSchema());

    expect($defs.Note.properties.note['x-field-access']).toEqual({ read: { permission: 'care:note.read' } });
  });

  it('are kept when the schema is shared after it was marked, in the contract and in the answer', async () => {
    const note = sharedSchema('Note', withFieldAccess(zodSchema(noteShape), reserved));
    const definition = z.object({ properties: z.object({ note: z.record(z.string(), z.unknown()) }) });
    const { $defs } = z.object({ $defs: z.object({ Note: definition }) }).parse(note.toJsonSchema());

    const read = defineRoute(
      {
        method: 'GET',
        path: '/notes/:noteId',
        operationId: 'readNote',
        summary: 'Read a note',
        responses: { 200: { description: 'The note.', body: note } },
        security: false,
      },
      () => ({ status: 200, body: { id: 'n1', note: 'fragile' } }),
    );

    const response = await executeRoute(read, request());

    expect($defs.Note.properties.note['x-field-access']).toEqual({ read: { permission: 'care:note.read' } });
    expect(response.body).toEqual({ id: 'n1' });
  });

  it('are left out of each item of a page shared under the name of its item', async () => {
    const item = withFieldAccess(sharedSchema('Note', zodSchema(noteShape)), reserved);
    const page: { items: z.infer<typeof noteShape>[] } = { items: [{ id: 'n1', note: 'fragile' }] };

    const search = defineRoute(
      {
        method: 'GET',
        path: '/notes',
        operationId: 'searchNotes',
        summary: 'Search notes',
        responses: { 200: { description: 'One page.', body: pageSchemaOf(item) } },
        security: false,
      },
      () => ({ status: 200, body: page }),
    );

    const response = await executeRoute(search, request());

    expect(pageSchemaOf(item).toJsonSchema()['$ref']).toBe('#/$defs/NotePage');
    expect(response.body).toEqual({ items: [{ id: 'n1' }] });
  });
});

describe('a form of a shared body', () => {
  it('describes the fields of the definition the body refers to', async () => {
    const booking = sharedSchema(
      'Booking',
      zodSchema(z.object({ calendarId: z.string(), startsAt: z.iso.datetime() })),
    );

    const book = defineRoute(
      {
        method: 'POST',
        path: '/bookings',
        operationId: 'book',
        summary: 'Book',
        request: { body: booking },
        responses: { 201: { description: 'Booked.' } },
        security: false,
        form: {},
      },
      () => ({ status: 201 }),
    );

    const [form] = formRoutes([book]);
    const response = form === undefined ? undefined : await executeRoute(form, { ...request(), params: {} });

    expect(response?.status).toBe(200);
    expect(response?.body).toMatchObject({ schema: { properties: { calendarId: {}, startsAt: {} } } });
  });
});
