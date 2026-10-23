import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NotFoundError, type Actor } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  Authenticated,
  CacheScope,
  Controller,
  Public,
  RouteGroup,
  controllerRoute,
  defineRoute,
  executeRoute,
  type CachePolicy,
  type RawRequest,
  type Route,
} from '../src';
import { generateOpenApi } from '../src/openapi';

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };
const hours = zodSchema(z.object({ opens: z.string() }));

const request = (overrides: Partial<RawRequest> = {}): RawRequest => ({
  params: {},
  query: {},
  headers: {},
  body: undefined,
  raw: null,
  ...overrides,
});

const shared: CachePolicy = {
  scope: CacheScope.public,
  maxAge: '1m',
  sMaxAge: '5m',
  staleWhileRevalidate: '30s',
  staleIfError: '1d',
  vary: ['Accept-Language'],
};

function openingHours(cache: CachePolicy | undefined, security: readonly string[] | false = false): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/opening-hours',
      operationId: 'readOpeningHours',
      summary: 'Read the opening hours',
      responses: { 200: { description: 'The hours.', body: hours } },
      errors: ['NOT_FOUND'],
      security,
      ...(cache === undefined ? {} : { cache }),
    },
    () => ({ status: 200, body: { opens: '08:00' } }),
  );
}

function declaring(cache: CachePolicy, method: 'GET' | 'POST' = 'GET', security: readonly string[] | false = false) {
  return (): Route =>
    defineRoute(
      {
        method,
        path: '/rates',
        operationId: 'readRates',
        summary: 'Read the rates',
        responses: { 200: { description: 'The rates.' } },
        security,
        cache,
      },
      () => ({ status: 200 }),
    );
}

describe('a cache policy', () => {
  it('answers its directives in Cache-Control, in a fixed order, and what the answer varies on', async () => {
    const response = await executeRoute(openingHours(shared), request());

    expect(response.headers['cache-control']).toBe(
      'public, max-age=60, s-maxage=300, stale-while-revalidate=30, stale-if-error=86400',
    );

    expect(response.headers['vary']).toBe('Accept-Language');
  });

  it('says private, must-revalidate and a freshness of zero as written', async () => {
    const cache: CachePolicy = { scope: CacheScope.private, maxAge: '0s', mustRevalidate: true };
    const response = await executeRoute(openingHours(cache, ['bearer']), request());

    expect(response.headers['cache-control']).toBe('private, max-age=0, must-revalidate');
    expect(response.headers['vary']).toBeUndefined();
  });

  it('never lets a refusal be kept', async () => {
    const refusing = defineRoute({ ...openingHours(shared), operationId: 'readClosedHours', path: '/closed' }, () => {
      throw new NotFoundError('No such practice.');
    });

    const response = await executeRoute(refusing, request());

    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('is no-store by default for a route that knows its caller, refusals included, and nothing for a public one', async () => {
    const guarded = openingHours(undefined, ['bearer']);

    const refused = defineRoute({ ...guarded, operationId: 'refuse', path: '/refuse' }, () => {
      throw new NotFoundError('No.');
    });

    expect((await executeRoute(guarded, request(), { resolvePrincipal: () => ada })).headers['cache-control']).toBe(
      'no-store',
    );

    expect((await executeRoute(refused, request())).headers['cache-control']).toBe('no-store');
    expect((await executeRoute(openingHours(undefined), request())).headers['cache-control']).toBeUndefined();
  });

  it('gives way to a header the handler answers itself', async () => {
    const own = defineRoute(
      {
        method: 'GET',
        path: '/own',
        operationId: 'readOwn',
        summary: 'Read with an own header',
        responses: { 200: { description: 'Done.' } },
        security: ['bearer'],
      },
      () => ({ status: 200, headers: { 'Cache-Control': 'private, max-age=5' } }),
    );

    expect((await executeRoute(own, request())).headers['cache-control']).toBe('private, max-age=5');
  });

  it('is documented on the answer it applies to, in the contract', () => {
    const document = generateOpenApi({ info: { title: 'Hours', version: '1' }, routes: [openingHours(shared)] });
    const answer = document.paths['/opening-hours']?.['get']?.['responses'];

    expect(answer).toMatchObject({
      '200': {
        headers: {
          'Cache-Control': {
            schema: {
              type: 'string',
              const: 'public, max-age=60, s-maxage=300, stale-while-revalidate=30, stale-if-error=86400',
            },
          },
          Vary: { schema: { type: 'string', const: 'Accept-Language' } },
        },
      },
    });

    expect(answer).not.toHaveProperty(['404', 'headers']);
  });
});

describe('a cache policy that cannot stand', () => {
  it('is refused on a write', () => {
    expect(declaring({ scope: CacheScope.public, maxAge: '1m' }, 'POST')).toThrow(
      /only the answer of a read \(GET, HEAD\) is kept by a cache/,
    );

    expect(declaring({ scope: CacheScope.noStore }, 'POST')).not.toThrow();
  });

  it('is refused without a freshness, with one that is not whole seconds, or with one on no-store', () => {
    expect(declaring({ scope: CacheScope.public })).toThrow(/declare maxAge, '0s' to have it revalidated each time/);

    expect(declaring({ scope: CacheScope.public, maxAge: '1500ms' })).toThrow(
      /"1500ms" is not a whole number of seconds/,
    );

    expect(declaring({ scope: CacheScope.public, maxAge: '2000ms' })).not.toThrow();
    expect(declaring({ scope: CacheScope.noStore, staleIfError: '1m' })).toThrow(/a no-store answer is kept by nobody/);
  });

  it('is refused when a private answer speaks to shared caches', () => {
    expect(declaring({ scope: CacheScope.private, maxAge: '1m', sMaxAge: '5m' })).toThrow(
      /sMaxAge speaks to shared caches/,
    );
  });

  it('is refused when the answer of a route that knows its caller would be shared without saying what it varies on', () => {
    expect(declaring({ scope: CacheScope.public, maxAge: '1m' }, 'GET', ['bearer'])).toThrow(
      /the route knows its caller, and a public answer is kept by shared caches/,
    );

    expect(
      declaring({ scope: CacheScope.public, maxAge: '1m', vary: ['Authorization'] }, 'GET', ['bearer']),
    ).not.toThrow();

    expect(declaring({ scope: CacheScope.private, maxAge: '1m' }, 'GET', ['bearer'])).not.toThrow();
  });
});

describe('the cache policy of a controller', () => {
  class CatalogRoutes {}
  class PricesRoutes {}

  RouteGroup({ prefix: '/catalog', guards: [Public], cache: { scope: CacheScope.public, maxAge: '10m' } })(
    CatalogRoutes,
  );

  RouteGroup({ parent: CatalogRoutes, prefix: '/prices', cache: { scope: CacheScope.public, maxAge: '1m' } })(
    PricesRoutes,
  );

  const read = { method: 'GET', summary: 'Read', response: { status: 200, body: hours } } as const;

  it('is the one of its group, of the nearest group that declares one, or its own', () => {
    class ReadCatalogController {
      handle(): { opens: string } {
        return { opens: '08:00' };
      }
    }

    class ReadPriceController {
      handle(): { opens: string } {
        return { opens: '08:00' };
      }
    }

    class ReadOfferController {
      handle(): { opens: string } {
        return { opens: '08:00' };
      }
    }

    Controller({ ...read, group: CatalogRoutes, path: '/' })(ReadCatalogController);
    Controller({ ...read, group: PricesRoutes, path: '/:sku' })(ReadPriceController);

    Controller({ ...read, group: PricesRoutes, path: '/offers', cache: { scope: CacheScope.noStore } })(
      ReadOfferController,
    );

    expect(controllerRoute(new ReadCatalogController()).cache).toEqual({ scope: 'public', maxAge: '10m' });
    expect(controllerRoute(new ReadPriceController()).cache).toEqual({ scope: 'public', maxAge: '1m' });
    expect(controllerRoute(new ReadOfferController()).cache).toEqual({ scope: 'no-store' });
  });

  it('goes to the reads of its group only: a write of the group keeps the default of a write', async () => {
    class OpeningRoutes {}

    RouteGroup({ prefix: '/opening', guards: [Public], cache: { scope: CacheScope.public, maxAge: '10m' } })(
      OpeningRoutes,
    );

    class SetOpeningController {
      handle(): undefined {
        return undefined;
      }
    }

    class ReadOpeningController {
      handle(): { opens: string } {
        return { opens: '08:00' };
      }
    }

    Controller({ method: 'PUT', summary: 'Set', group: OpeningRoutes, path: '/', response: { status: 204 } })(
      SetOpeningController,
    );

    Controller({ ...read, group: OpeningRoutes, path: '/' })(ReadOpeningController);

    const write = controllerRoute(new SetOpeningController());

    expect(write.cache).toBeUndefined();
    expect((await executeRoute(write, request())).headers['cache-control']).toBeUndefined();
    expect(controllerRoute(new ReadOpeningController()).cache).toEqual({ scope: 'public', maxAge: '10m' });
  });

  it('is held to the guards before it: a group behind Authenticated shares nothing it does not vary', () => {
    class AccountRoutes {}

    RouteGroup({ prefix: '/account', guards: [Authenticated], cache: { scope: CacheScope.public, maxAge: '1m' } })(
      AccountRoutes,
    );

    class ReadAccountController {
      handle(): { opens: string } {
        return { opens: '08:00' };
      }
    }

    Controller({ ...read, group: AccountRoutes, path: '/' })(ReadAccountController);

    expect(() => controllerRoute(new ReadAccountController())).toThrow(
      /Route "readAccount" \(GET \/account\): the route knows its caller/,
    );
  });
});
