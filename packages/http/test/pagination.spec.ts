import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cursorPage, offsetPage, pageOf } from '@ddd-ts-kit/kernel';
import { ValidationError } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  defineRoute,
  executeRoute,
  pageQuerySchema,
  pageRequestFrom,
  pageRequestParameters,
  pageResponse,
  pageSchemaOf,
  type RawRequest,
} from '../src';
import { generateOpenApi } from '../src/openapi';

const SORTABLE = ['placedAt', 'total'] as const;

const issuesOf = (query: unknown, options = {}): unknown => {
  try {
    pageRequestFrom(query, options);
  } catch (error) {
    return error instanceof ValidationError ? error.issues.map(({ path, code }) => `${path}: ${code}`) : error;
  }

  return 'accepted';
};

describe('pageRequestFrom', () => {
  it('answers the first page of the default size for an empty query', () => {
    expect(pageRequestFrom({})).toEqual(offsetPage());
    expect(pageRequestFrom(undefined)).toEqual(offsetPage());
    expect(pageRequestFrom({}, { kind: 'cursor' })).toEqual(cursorPage());
  });

  it('reads an offset page from strings, as frameworks hand them over, or from numbers', () => {
    expect(pageRequestFrom({ offset: '40', limit: '10' })).toEqual(offsetPage({ offset: 40, limit: 10 }));
    expect(pageRequestFrom({ offset: 40, limit: 10 })).toEqual(offsetPage({ offset: 40, limit: 10 }));
    expect(pageRequestFrom({ offset: '40' }, { kind: 'cursor' })).toEqual(offsetPage({ offset: 40 }));
  });

  it('reads a cursor page as soon as a cursor is given', () => {
    expect(pageRequestFrom({ cursor: 'abc', limit: '5' })).toEqual(cursorPage({ cursor: 'abc', limit: 5 }));
  });

  it('reads the sort among the sortable fields, a leading "-" for descending', () => {
    const page = pageRequestFrom({ sort: '-placedAt, total' }, { sortable: SORTABLE });

    expect(page.sort).toEqual([
      { field: 'placedAt', direction: 'desc' },
      { field: 'total', direction: 'asc' },
    ]);

    expect(pageRequestFrom({ sort: ['-placedAt', 'total'] }, { sortable: SORTABLE }).sort).toEqual(page.sort);
  });

  it('honours the limits of the read port', () => {
    const limits = { defaultSize: 5, maxSize: 10 };

    expect(pageRequestFrom({}, limits).limit).toBe(5);
    expect(issuesOf({ limit: '11' }, limits)).toEqual(['query.limit: invalid_limit']);
  });

  it.each([
    [{ limit: '0' }, ['query.limit: invalid_limit']],
    [{ limit: '101' }, ['query.limit: invalid_limit']],
    [{ limit: '1e2' }, ['query.limit: invalid_limit']],
    [{ limit: '-1' }, ['query.limit: invalid_limit']],
    [{ offset: '1.5' }, ['query.offset: invalid_offset']],
    [{ offset: ['1', '2'] }, ['query.offset: invalid_offset']],
    [{ cursor: '' }, ['query.cursor: invalid_cursor']],
    [{ cursor: 'abc', offset: '0' }, ['query.cursor: offset_with_cursor']],
    [{ sort: 'password' }, ['query.sort: unsortable_field']],
    [{ sort: { field: 'total' } }, ['query.sort: invalid_sort']],
    [{ limit: 'x', offset: 'y' }, ['query.limit: invalid_limit', 'query.offset: invalid_offset']],
  ])('refuses %j with %j', (query, issues) => {
    expect(issuesOf(query, { sortable: SORTABLE })).toEqual(issues);
  });

  it('refuses any sort when the read port declares no sortable field', () => {
    expect(issuesOf({ sort: 'total' })).toEqual(['query.sort: unsortable_field']);
  });
});

describe('pageResponse', () => {
  it('maps the items and keeps total and nextCursor only when the page has them', () => {
    const page = pageOf([{ id: 1 }, { id: 2 }], { total: 12, nextCursor: 'abc' });

    expect(pageResponse(page, (item) => `#${item.id}`)).toEqual({ items: ['#1', '#2'], total: 12, nextCursor: 'abc' });
    expect(pageResponse(pageOf([]), (item) => item)).toEqual({ items: [] });
  });
});

describe('a paginated route', () => {
  const order = zodSchema(z.object({ id: z.string(), total: z.number() }), { io: 'output' });

  const searchOrders = defineRoute(
    {
      method: 'GET',
      path: '/orders',
      operationId: 'searchOrders',
      summary: 'Search orders',
      request: { query: pageQuerySchema({ sortable: SORTABLE, maxSize: 50 }) },
      responses: { 200: { description: 'A page of orders.', body: pageSchemaOf(order) } },
      security: ['bearer'],
    },
    ({ query }) => ({
      status: 200,
      body: pageResponse(pageOf([{ id: 'o-1', total: 30, internal: query.kind }], { total: 1 }), ({ id, total }) => ({
        id,
        total,
      })),
    }),
  );

  const call = (query: Record<string, unknown>) => {
    const request: RawRequest = { params: {}, query, headers: {}, body: undefined, raw: undefined };

    return executeRoute(searchOrders, request, { validateResponses: true });
  };

  it('answers the page in the declared shape', async () => {
    expect(await call({ limit: '10', sort: '-total' })).toMatchObject({
      status: 200,
      body: { items: [{ id: 'o-1', total: 30 }], total: 1 },
    });
  });

  it('answers 422 with one issue per wrong parameter, located in the query', async () => {
    expect(await call({ limit: '500', sort: 'secret' })).toMatchObject({
      status: 422,
      body: { code: 'VALIDATION_FAILED', issues: [{ path: 'query.limit' }, { path: 'query.sort' }] },
    });
  });

  it('describes its parameters and its answer in the contract', () => {
    const document = generateOpenApi({ info: { title: 'Orders', version: '1.0.0' }, routes: [searchOrders] });
    const operation = document.paths['/orders']?.['get'];

    expect(operation?.['parameters']).toMatchObject([
      {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0 } },
      { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
      { name: 'sort', in: 'query', required: false, schema: { type: 'string' } },
    ]);

    expect(operation?.['responses']).toMatchObject({
      200: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: { items: { type: 'array', items: { type: 'object' } }, total: { type: 'integer' } },
            },
          },
        },
      },
    });
  });
});

describe('pageRequestParameters', () => {
  it('leaves sort out when nothing is sortable', () => {
    expect(Object.keys(pageRequestParameters()['properties'] ?? {})).toEqual(['limit', 'offset', 'cursor']);
  });
});

describe('pageSchemaOf', () => {
  const money = z.object({ amount: z.number() }).meta({ id: 'Money' });
  const page = pageSchemaOf(zodSchema(z.object({ id: z.string(), total: money })));

  it('locates the issues of an item in the page', () => {
    const parsed = page.parse({
      items: [
        { id: 'o-1', total: { amount: 1 } },
        { id: 2, total: { amount: 1 } },
      ],
      total: -1,
    });

    expect(parsed).toMatchObject({ ok: false, error: [{ path: 'items.1.id' }, { path: 'total' }] });
    expect(page.parse({ items: 'none' })).toMatchObject({ ok: false, error: [{ path: 'items' }] });
    expect(page.parse({ items: [], nextCursor: 42 })).toMatchObject({ ok: false, error: [{ path: 'nextCursor' }] });
  });

  it('moves the local definitions of the item schema to the top, where references resolve', () => {
    const schema = page.toJsonSchema();

    expect(schema).toHaveProperty('$defs.Money');
    expect(schema).not.toHaveProperty('properties.items.items.$defs');
  });
});
