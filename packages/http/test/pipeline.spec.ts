import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DomainError, InvariantViolation, NotFoundError } from '@ddd-ts-kit/kernel';
import { ValidationError } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  DEFAULT_ERROR_MAPPING,
  DuplicateRouteError,
  ResponseContractError,
  createErrorMapper,
  defineRoute,
  defineRoutes,
  executeRoute,
  prefixRoutes,
  toProblem,
  type RawRequest,
} from '../src/index.js';
import { getOrder, placeOrder } from './support/orders.js';

const request = (overrides: Partial<RawRequest> = {}): RawRequest => ({
  params: {},
  query: {},
  headers: {},
  body: undefined,
  raw: null,
  ...overrides,
});

const report = defineRoute(
  {
    method: 'GET',
    path: '/reports/:year',
    operationId: 'readReport',
    summary: 'Read a yearly report',
    request: {
      params: zodSchema(z.object({ year: z.coerce.number().int() })),
      headers: zodSchema(z.looseObject({ 'x-tenant': z.string() })),
    },
    responses: {
      200: { description: 'The report.', body: zodSchema(z.object({ year: z.number(), tenant: z.string() })) },
      204: { description: 'Nothing was recorded that year.' },
    },
    security: false,
  },
  ({ params, headers }) => {
    // Type-level checks: the handler input and output follow the schemas.
    const year: number = params.year;
    const tenant: string = headers['x-tenant'];

    if (year === 1999) {
      return { status: 204 };
    }

    return { status: 200, body: { year, tenant } };
  },
);

defineRoute(
  {
    method: 'GET',
    path: '/typed',
    operationId: 'typed',
    summary: 'Typing',
    responses: { 200: { description: 'ok' } },
    security: false,
  },
  // @ts-expect-error a status the route does not declare is refused at compile time
  () => ({ status: 404 }),
);

defineRoute(
  {
    method: 'GET',
    path: '/typed',
    operationId: 'typed',
    summary: 'Typing',
    responses: { 200: { description: 'ok', body: zodSchema(z.object({ id: z.string() })) } },
    security: false,
  },
  // @ts-expect-error the body must match the declared schema
  () => ({ status: 200, body: { id: 1 } }),
);

describe('defineRoute', () => {
  it('refuses a path that is not portable across frameworks', () => {
    const declare = (path: string) => () =>
      defineRoute(
        {
          method: 'GET',
          path,
          operationId: 'x',
          summary: 'x',
          responses: { 200: { description: 'ok' } },
          security: false,
        },
        () => ({ status: 200 }),
      );

    expect(declare('orders')).toThrow(/literal segments/);
    expect(declare('/orders/*')).toThrow(/literal segments/);
    expect(declare('/orders/{orderId}')).toThrow(/literal segments/);
    expect(declare('/')).not.toThrow();
    expect(declare('/orders/:orderId/lines/:line_no')).not.toThrow();
  });
});

describe('defineRoutes', () => {
  it('flattens groups of routes', () => {
    expect(defineRoutes([placeOrder], getOrder, [report])).toEqual([placeOrder, getOrder, report]);
  });

  it('refuses two routes sharing an operationId', () => {
    expect(() => defineRoutes(report, { ...report, path: '/elsewhere' })).toThrow(DuplicateRouteError);
  });

  it('refuses two routes sharing a method and a path, whatever the parameter is called', () => {
    const twin = { ...report, operationId: 'readReportAgain', path: '/reports/:y' };

    expect(() => defineRoutes(report, twin)).toThrow(/GET \/reports\/:y/);
  });
});

describe('prefixRoutes', () => {
  it('puts every route under the prefix', () => {
    const paths = prefixRoutes('/api/v1/', [placeOrder, getOrder]).map((route) => route.path);

    expect(paths).toEqual(['/api/v1/orders', '/api/v1/orders/:orderId']);
  });
});

describe('the error mapper', () => {
  it('knows the default codes', () => {
    expect(DEFAULT_ERROR_MAPPING).toEqual({
      VALIDATION_FAILED: 422,
      NOT_FOUND: 404,
      CONFLICT: 409,
      INVARIANT_VIOLATION: 422,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
    });
  });

  it('lets a project add and override codes', () => {
    const mapper = createErrorMapper({ INVARIANT_VIOLATION: 400, QUOTA_EXCEEDED: 429 });

    expect(mapper.statusOf('INVARIANT_VIOLATION')).toBe(400);
    expect(mapper.statusOf('QUOTA_EXCEEDED')).toBe(429);
    expect(mapper.statusOf('NOT_FOUND')).toBe(404);
  });

  it('answers 422 for a domain code nobody mapped, unless told otherwise', () => {
    expect(createErrorMapper().statusOf('SOMETHING_NEW')).toBe(422);
    expect(createErrorMapper({}, { fallbackStatus: 400 }).statusOf('SOMETHING_NEW')).toBe(400);
  });
});

describe('toProblem', () => {
  const mapper = createErrorMapper();

  it('describes a domain error with its code, status and message', () => {
    expect(toProblem(new NotFoundError('Order 7 does not exist.'), mapper, 'req-1')).toEqual({
      type: 'urn:problem:not-found',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
      detail: 'Order 7 does not exist.',
      requestId: 'req-1',
    });
  });

  it('carries the issues of a validation error', () => {
    const issues = [{ path: 'body.sku', code: 'too_small', message: 'Too short.' }];

    expect(toProblem(new ValidationError(issues), mapper, 'req-1')).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      issues,
    });
  });

  it('builds the type URI the project asked for', () => {
    const custom = createErrorMapper({}, { typeOf: (code) => `https://errors.example.com/${code}` });

    expect(toProblem(new InvariantViolation('No.'), custom, 'r').type).toBe(
      'https://errors.example.com/INVARIANT_VIOLATION',
    );
  });

  it('never exposes the message of an unexpected error', () => {
    for (const error of [new Error('password=hunter2'), 'password=hunter2', { code: 'NOT_FOUND' }, null]) {
      expect(toProblem(error, mapper, 'req-1')).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        code: 'INTERNAL_ERROR',
        requestId: 'req-1',
      });
    }
  });

  it('hides the detail of a domain error mapped to a server fault', () => {
    class LedgerUnavailable extends DomainError {
      readonly code = 'LEDGER_UNAVAILABLE';
    }

    const problem = toProblem(
      new LedgerUnavailable('ledger at 10.0.0.4 timed out'),
      createErrorMapper({ LEDGER_UNAVAILABLE: 503 }),
      'req-1',
    );

    expect(problem).toEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      code: 'LEDGER_UNAVAILABLE',
      requestId: 'req-1',
    });
  });
});

describe('executeRoute', () => {
  it('hands the handler the values produced by the schemas', async () => {
    const response = await executeRoute(
      report,
      request({ params: { year: '2024' }, headers: { 'x-tenant': 'acme', accept: '*/*' } }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ year: 2024, tenant: 'acme' });
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
  });

  it('reports the issues of every invalid part at once', async () => {
    const response = await executeRoute(report, request({ params: { year: 'soon' } }));

    expect(response.status).toBe(422);

    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      issues: [{ path: 'params.year' }, { path: 'headers.x-tenant' }],
    });
  });

  it('uses the request id strategy it is given', async () => {
    const response = await executeRoute(report, request(), { requestId: () => 'fixed' });

    expect(response.headers['x-request-id']).toBe('fixed');
    expect(response.body).toMatchObject({ requestId: 'fixed' });
  });

  it('ignores an incoming request id that could be an injection', async () => {
    const response = await executeRoute(
      report,
      request({ params: { year: '1999' }, headers: { 'x-tenant': 'acme', 'x-request-id': 'a b\nc' } }),
    );

    expect(response.status).toBe(204);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response).not.toHaveProperty('body');
  });

  it('survives a logging hook that throws', async () => {
    const response = await executeRoute(report, request(), {
      onError: () => {
        throw new Error('logger down');
      },
    });

    expect(response.status).toBe(422);
  });

  describe('when responses are validated', () => {
    const drifting = (status: number, body?: unknown) => ({
      ...report,
      handle: () => ({ status, ...(body === undefined ? {} : { body }) }),
    });

    const valid = request({ params: { year: '2024' }, headers: { 'x-tenant': 'acme' } });

    const run = async (status: number, body?: unknown) => {
      const errors: unknown[] = [];

      const response = await executeRoute(drifting(status, body), valid, {
        validateResponses: true,
        onError: (error) => errors.push(error),
      });

      return { response, error: errors[0] };
    };

    it('lets a declared response through', async () => {
      expect((await run(200, { year: 2024, tenant: 'acme' })).response.status).toBe(200);
    });

    it('reports an undeclared status as a server fault', async () => {
      const { response, error } = await run(202);

      expect(response.status).toBe(500);
      expect(error).toBeInstanceOf(ResponseContractError);
    });

    it('reports a body that does not match its schema, with the issues for the log', async () => {
      const { response, error } = await run(200, { year: '2024' });

      expect(response.status).toBe(500);
      expect(error).toMatchObject({ issues: expect.arrayContaining([expect.objectContaining({ path: 'year' })]) });
    });

    it('reports a body where none is declared', async () => {
      expect((await run(204, { surprise: true })).response.status).toBe(500);
    });
  });

  it('does not check responses unless asked', async () => {
    const drifting = { ...report, handle: () => ({ status: 202 }) };

    expect(
      (await executeRoute(drifting, request({ params: { year: '1' }, headers: { 'x-tenant': 'a' } }))).status,
    ).toBe(202);
  });
});
