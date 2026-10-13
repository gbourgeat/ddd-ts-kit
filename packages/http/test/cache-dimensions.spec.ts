import express from 'express';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  CacheScope,
  CacheTagHeader,
  defineRoute,
  executeRoute,
  firstTenantOf,
  tenantFromHeader,
  tenantFromSubdomain,
  type CachePolicy,
  type ExecuteOptions,
  type RawRequest,
  type Route,
} from '../src/index.js';
import { mountExpress } from '../src/express.js';

const hours = zodSchema(z.object({ opens: z.string() }));
const kept: CachePolicy = { scope: CacheScope.public, maxAge: '1m', sMaxAge: '1h' };
const tagged: CachePolicy = { ...kept, tags: [{ resource: 'calendar', param: 'calendarId' }] };

function readHours(cache: CachePolicy, security: readonly string[] | false = false): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/calendars/:calendarId/hours',
      operationId: 'readHours',
      summary: 'Read the hours',
      responses: { 200: { description: 'The hours.', body: hours } },
      security,
      cache,
    },
    () => ({ status: 200, body: { opens: '08:00' } }),
  );
}

const request = (headers: RawRequest['headers'] = {}): RawRequest => ({
  params: { calendarId: 'c-1' },
  query: {},
  headers,
  body: undefined,
  raw: null,
});

const mounted =
  (route: Route, options: ExecuteOptions = {}) =>
  (): void =>
    mountExpress(express.Router(), [route], options);

describe('a public answer of a route that knows its caller', () => {
  it('is refused at the mount unless it varies on who calls, or on the header its tenant is read from', () => {
    const onLanguage = readHours({ ...kept, vary: ['Accept-Language'] }, ['bearer']);
    const onCredential = readHours({ ...kept, vary: ['Accept-Language', 'authorization'] }, ['bearer']);
    const onTenant = readHours({ ...kept, vary: ['X-Tenant-Id'] }, ['bearer']);

    expect(mounted(onLanguage)).toThrow(/name in vary one of authorization, cookie, what says who calls or the tenant/);
    expect(mounted(onCredential)).not.toThrow();
    expect(mounted(onTenant)).toThrow(/authorization, cookie,/);
    expect(mounted(onTenant, { resolveTenant: tenantFromHeader() })).not.toThrow();
  });
});

describe('a cached answer in a tenant read from a header', () => {
  it('varies on that header, so that a cache keeps one copy per tenant', async () => {
    const options: ExecuteOptions = { resolveTenant: tenantFromHeader('X-Tenant-Id') };
    const answer = await executeRoute(readHours({ ...kept, vary: ['Accept-Language'] }), request(), options);

    expect(answer.headers['vary']).toBe('Accept-Language, x-tenant-id');
  });

  it('varies on the headers of every resolver tried, and on none for the host every cache keys on', async () => {
    const tried = firstTenantOf(tenantFromSubdomain('app.example.com'), tenantFromHeader());
    const answer = await executeRoute(readHours(kept), request(), { resolveTenant: tried });

    expect(answer.headers['vary']).toBe('x-tenant-id');

    const byHost = await executeRoute(readHours(kept), request(), {
      resolveTenant: tenantFromSubdomain('app.example.com'),
    });

    expect(byHost.headers['vary']).toBeUndefined();
  });

  it('says nothing more when no cache keeps it', async () => {
    const answer = await executeRoute(readHours({ scope: CacheScope.noStore }), request(), {
      resolveTenant: tenantFromHeader(),
    });

    expect(answer.headers['vary']).toBeUndefined();
  });
});

describe('a public answer behind a cache that ignores Vary', () => {
  const cloudflare: ExecuteOptions = { cacheTags: { header: CacheTagHeader.cacheTag } };

  it('is refused at the mount when it varies, declared or through its tenant', () => {
    expect(mounted(readHours({ ...kept, vary: ['Accept-Language'] }), cloudflare)).toThrow(
      /the cache in front \(cache-tag\) ignores Vary/,
    );

    expect(mounted(readHours(kept), { ...cloudflare, resolveTenant: tenantFromHeader() })).toThrow(/ignores Vary/);
    expect(mounted(readHours(kept), cloudflare)).not.toThrow();
  });

  it('stands once the application says the cache keys on those headers', () => {
    const keyed: ExecuteOptions = { cacheTags: { header: CacheTagHeader.cacheTag, honoursVary: true } };

    expect(mounted(readHours({ ...kept, vary: ['Accept-Language'] }), keyed)).not.toThrow();

    expect(
      mounted(readHours({ ...kept, vary: ['Accept-Language'] }), { cacheTags: { header: CacheTagHeader.xkey } }),
    ).not.toThrow();
  });
});

describe('a tagged answer filed per tenant', () => {
  const perTenant = { header: CacheTagHeader.xkey, perTenant: true };

  it('is refused at the mount on a route anybody may call, when nothing names the tenant of an anonymous call', () => {
    expect(mounted(readHours(tagged), { cacheTags: perTenant })).toThrow(
      /an anonymous call names no tenant: no purge would ever meet its answer/,
    );

    expect(mounted(readHours(tagged), { cacheTags: perTenant, resolveTenant: tenantFromHeader() })).not.toThrow();
    expect(mounted(readHours(kept), { cacheTags: perTenant })).not.toThrow();
  });

  it('is kept by nobody, and carries no tag, when the request names no tenant', async () => {
    const options: ExecuteOptions = { cacheTags: perTenant, resolveTenant: tenantFromHeader() };
    const anonymous = await executeRoute(readHours(tagged), request(), options);
    const ofAcme = await executeRoute(readHours(tagged), request({ 'x-tenant-id': 'acme' }), options);

    expect(anonymous.headers['cache-control']).toBe('no-store');
    expect(anonymous.headers['xkey']).toBeUndefined();
    expect(ofAcme.headers['cache-control']).toBe('public, max-age=60, s-maxage=3600');
    expect(ofAcme.headers['xkey']).toBe('acme/calendar:c-1');
    expect(ofAcme.headers['vary']).toBe('x-tenant-id');
  });
});
