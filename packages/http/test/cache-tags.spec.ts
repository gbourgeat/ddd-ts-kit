import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NotFoundError, type Actor } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  CacheScope,
  CacheTagHeader,
  defineRoute,
  executeRoute,
  type CachePolicy,
  type ExecuteOptions,
  type RawRequest,
  type Route,
} from '../src/index.js';
import { generateOpenApi } from '../src/openapi.js';

const day = zodSchema(z.object({ calendarId: z.string(), items: z.array(z.object({ id: z.string() })) }));
const ofAcme: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };

const tagged: CachePolicy = {
  scope: CacheScope.public,
  maxAge: '1m',
  etag: 'representation',
  tags: [
    { resource: 'calendar', param: 'calendarId' },
    { resource: 'appointment', field: 'items.id' },
    { resource: 'appointment' },
  ],
};

function appointments(): { id: string }[] {
  return [{ id: 'a-1' }, { id: 'a 2' }];
}

function readDay(cache: CachePolicy, refuse = false): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/calendars/:calendarId/day',
      operationId: 'readDay',
      summary: 'Read a day',
      request: { params: zodSchema(z.object({ calendarId: z.string() })) },
      responses: { 200: { description: 'The day.', body: day } },
      errors: ['NOT_FOUND'],
      security: false,
      cache,
    },
    ({ params }) => {
      if (refuse) {
        throw new NotFoundError('No such calendar.');
      }

      return { status: 200, body: { calendarId: params.calendarId, items: appointments() } };
    },
  );
}

const request = (headers: RawRequest['headers'] = {}): RawRequest => ({
  params: { calendarId: 'c-1' },
  query: {},
  headers,
  body: undefined,
  raw: null,
});

const behind = (header: CacheTagHeader): ExecuteOptions => ({ cacheTags: { header } });

describe('the tags of a public answer', () => {
  it('name the resources it shows, from the path and the body, in the header Varnish reads', async () => {
    const response = await executeRoute(readDay(tagged), request(), behind(CacheTagHeader.xkey));

    expect(response.headers['xkey']).toBe('calendar:c-1 appointment:a-1 appointment:a%202 appointment');
  });

  it('are separated by commas in the headers of the CDNs that read them so', async () => {
    const cloudflare = await executeRoute(readDay(tagged), request(), behind(CacheTagHeader.cacheTag));
    const fastly = await executeRoute(readDay(tagged), request(), behind(CacheTagHeader.surrogateKey));

    expect(cloudflare.headers['cache-tag']).toBe('calendar:c-1,appointment:a-1,appointment:a%202,appointment');
    expect(fastly.headers['surrogate-key']).toBe('calendar:c-1 appointment:a-1 appointment:a%202 appointment');
  });

  it('are filed under the tenant of the request when the application tags per tenant', async () => {
    const perTenant = await executeRoute(readDay(tagged), request(), {
      cacheTags: { header: CacheTagHeader.xkey, perTenant: true },
      resolvePrincipal: () => ofAcme,
    });

    const shared = await executeRoute(readDay(tagged), request(), {
      ...behind(CacheTagHeader.xkey),
      resolvePrincipal: () => ofAcme,
    });

    expect(perTenant.headers['xkey']).toBe(
      'acme/calendar:c-1 acme/appointment:a-1 acme/appointment:a%202 acme/appointment',
    );

    expect(shared.headers['xkey']).toBe('calendar:c-1 appointment:a-1 appointment:a%202 appointment');
  });

  it('stay on a 304, which a shared cache merges into what it keeps', async () => {
    const first = await executeRoute(readDay(tagged), request(), behind(CacheTagHeader.xkey));

    const again = await executeRoute(
      readDay(tagged),
      request({ 'if-none-match': first.headers['etag'] }),
      behind(CacheTagHeader.xkey),
    );

    expect(again.status).toBe(304);
    expect(again.headers['xkey']).toBe(first.headers['xkey']);
  });

  it('are not sent when the application names no header, nor on a refusal', async () => {
    expect((await executeRoute(readDay(tagged), request())).headers['xkey']).toBeUndefined();

    expect(
      (await executeRoute(readDay(tagged, true), request(), behind(CacheTagHeader.xkey))).headers['xkey'],
    ).toBeUndefined();
  });

  it('are listed as templates in the contract', () => {
    const operation = generateOpenApi({ info: { title: 'Days', version: '1' }, routes: [readDay(tagged)] }).paths[
      '/calendars/{calendarId}/day'
    ]?.['get'];

    expect(operation?.['x-cache-tags']).toEqual(['calendar:{calendarId}', 'appointment:{items.id}', 'appointment']);
  });
});

describe('tags that cannot stand', () => {
  it('are refused on an answer no shared cache keeps, or when they read a parameter the path does not have', () => {
    expect(() => readDay({ scope: CacheScope.private, maxAge: '0s', tags: [{ resource: 'calendar' }] })).toThrow(
      /tags file an answer in a shared cache/,
    );

    expect(() =>
      readDay({ scope: CacheScope.public, maxAge: '1m', tags: [{ resource: 'calendar', param: 'id' }] }),
    ).toThrow(/reads the parameter "id", which the path does not have/);
  });
});
