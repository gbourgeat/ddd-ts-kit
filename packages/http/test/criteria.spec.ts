import { parse as parseQueryString } from 'node:querystring';
import { describe, expect, it } from 'vitest';
import { defineCriteria, evaluateCriteria, pageOf, scoped, type Criteria, type FilterNode } from '@ddd-ts-kit/kernel';
import { ValidationError, customSchema } from '@ddd-ts-kit/validation';
import {
  criteriaFrom,
  criteriaParameters,
  criteriaQuerySchema,
  defineRoute,
  executeRoute,
  pageResponse,
  pageSchemaOf,
  type RawRequest,
} from '../src/index.js';
import { generateOpenApi } from '../src/openapi.js';

interface AppointmentRow {
  readonly id: string;
  readonly status: 'booked' | 'confirmed' | 'cancelled';
  readonly title: string;
  readonly seats: number;
  readonly price: string;
  readonly startsAt: Date;
  readonly cancelledAt: Date | null;
  readonly remote: boolean;
  readonly tenantId: string;
}

const appointments = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string' },
    status: { type: 'string', filter: ['eq', 'ne', 'in'], sortable: true },
    title: { type: 'string', filter: ['eq', 'in', 'contains', 'startsWith'] },
    seats: { type: 'number', filter: ['eq', 'gte', 'lte', 'between', 'in'], sortable: true },
    price: { type: 'decimal', filter: ['gte'] },
    startsAt: { type: 'instant', filter: ['gte', 'lt', 'between'], sortable: true },
    cancelledAt: { type: 'instant', filter: ['isNull'], nullable: true },
    remote: { type: 'boolean', filter: ['eq'] },
    tenantId: { type: 'string' },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
  limits: { maxPageSize: 50, maxInList: 3 },
});

const condition = (field: string, operator: string, value: unknown): unknown => ({ kind: 'condition', field, operator, value });
const read = (search: string): Criteria<AppointmentRow> => criteriaFrom({ ...parseQueryString(search) }, appointments);
const filtersOf = (search: string): readonly FilterNode[] => read(search).filters;

const issuesOf = (query: unknown): unknown => {
  try {
    criteriaFrom(query, appointments);
  } catch (error) {
    return error instanceof ValidationError ? error.issues.map(({ path, code }) => `${path}: ${code}`) : error;
  }

  return 'accepted';
};

describe('criteriaFrom: the grammar', () => {
  it.each([
    ['filter[status]=eq:booked', [condition('status', 'eq', 'booked')]],
    ['filter[status]=booked', [condition('status', 'eq', 'booked')]],
    ['filter[status]=ne:booked', [condition('status', 'ne', 'booked')]],
    ['filter[status]=in:booked,confirmed', [condition('status', 'in', ['booked', 'confirmed'])]],
    ['filter[seats]=gte:2', [condition('seats', 'gte', 2)]],
    ['filter[seats]=between:2,4', [condition('seats', 'between', [2, 4])]],
    ['filter[seats]=in:1,5', [condition('seats', 'in', [1, 5])]],
    ['filter[price]=gte:10.50', [condition('price', 'gte', '10.50')]],
    ['filter[startsAt]=gte:2026-10-01T00:00:00Z', [condition('startsAt', 'gte', new Date('2026-10-01T00:00:00Z'))]],
    ['filter[startsAt]=gte:2026-10-01T02:00:00%2B02:00', [condition('startsAt', 'gte', new Date('2026-10-01T00:00:00Z'))]],
    ['filter[startsAt]=lt:2026-10-01', [condition('startsAt', 'lt', new Date('2026-10-01T00:00:00Z'))]],
    ['filter[remote]=eq:true', [condition('remote', 'eq', true)]],
    ['filter[remote]=false', [condition('remote', 'eq', false)]],
    ['filter[cancelledAt]=isNull:true', [condition('cancelledAt', 'isNull', true)]],
    ['filter[cancelledAt]=isNull:false', [condition('cancelledAt', 'isNull', false)]],
    ['filter[cancelledAt]=isNull', [condition('cancelledAt', 'isNull', true)]],
    ['filter[title]=contains:knee', [condition('title', 'contains', 'knee')]],
    ['filter[title]=startsWith:Follow-up: knee', [condition('title', 'startsWith', 'Follow-up: knee')]],
  ])('%s', (search, filters) => {
    expect(filtersOf(search)).toEqual(filters);
  });

  it('reads a value that holds a colon, a comma or the name of an operator', () => {
    expect(filtersOf('filter[title]=eq:in:the morning')).toEqual([condition('title', 'eq', 'in:the morning')]);
    expect(filtersOf('filter[title]=10:30 review')).toEqual([condition('title', 'eq', '10:30 review')]);
    expect(filtersOf('filter[title]=contains:a,b')).toEqual([condition('title', 'contains', 'a,b')]);
    expect(filtersOf('filter[title]=in:Annual\\, review,x\\\\y')).toEqual([condition('title', 'in', ['Annual, review', 'x\\y'])]);
    expect(filtersOf(`filter[title]=${encodeURIComponent("eq:'; drop table x; --")}`)).toEqual([condition('title', 'eq', "'; drop table x; --")]);
  });

  it('joins the conditions by AND, a repeated field included', () => {
    expect(filtersOf('filter[seats]=gte:2&filter[seats]=lte:4&filter[status]=booked')).toEqual([
      condition('seats', 'gte', 2),
      condition('seats', 'lte', 4),
      condition('status', 'eq', 'booked'),
    ]);
  });

  it('reads groups: or, not, and an index to hold several conditions together', () => {
    expect(filtersOf('filter[or][status]=cancelled&filter[or][seats]=gte:5')).toEqual([
      { kind: 'or', filters: [condition('status', 'eq', 'cancelled'), condition('seats', 'gte', 5)] },
    ]);

    expect(filtersOf('filter[or][0][status]=eq:booked&filter[or][1][status]=eq:cancelled&filter[status]=ne:confirmed')).toEqual([
      { kind: 'or', filters: [condition('status', 'eq', 'booked'), condition('status', 'eq', 'cancelled')] },
      condition('status', 'ne', 'confirmed'),
    ]);

    expect(filtersOf('filter[not][status]=booked&filter[not][remote]=true')).toEqual([
      { kind: 'not', filters: [condition('status', 'eq', 'booked'), condition('remote', 'eq', true)] },
    ]);
  });

  it('reads the same from a query the framework already nested', () => {
    const nested = { filter: { status: 'in:booked,confirmed', seats: ['gte:2', 'lte:4'], or: [{ status: 'cancelled' }, { remote: 'true' }] }, sort: '-startsAt,id', limit: '5' };
    const flat = 'filter[status]=in:booked,confirmed&filter[seats]=gte:2&filter[seats]=lte:4&filter[or][0][status]=cancelled&filter[or][1][remote]=true&sort=-startsAt,id&limit=5';

    expect(criteriaFrom(nested, appointments)).toEqual(read(flat));
    expect(read(flat).sort).toEqual([{ field: 'startsAt', direction: 'desc' }, { field: 'id', direction: 'asc' }]);
    expect(read(flat).pageRequest).toMatchObject({ kind: 'offset', offset: 0, limit: 5 });
  });

  it('reads the page with the helpers of pagination: limits of the definition, cursor or offset', () => {
    expect(read('').pageRequest).toMatchObject({ kind: 'offset', limit: 20 });
    expect(criteriaFrom({}, appointments, { kind: 'cursor' }).pageRequest).toMatchObject({ kind: 'cursor', limit: 20 });
    expect(issuesOf({ limit: '51' })).toEqual(['query.limit: invalid_limit']);
    expect(issuesOf({ cursor: 'made-up' })).toEqual(['query.cursor: invalid_cursor']);
  });
});

describe('criteriaFrom: what the read port does not declare', () => {
  it.each([
    ['a field that is not declared', 'filter[password]=x', ['query.filter.password: unknown_field']],
    ['a field declared without any operator', 'filter[tenantId]=acme', ['query.filter.tenantId: operator_not_allowed']],
    ['an operator the field does not declare', 'filter[status]=contains:book', ['query.filter.status: operator_not_allowed']],
    ['a value that is not a number', 'filter[seats]=gte:two', ['query.filter.seats: invalid_value']],
    ['a number written with an exponent', 'filter[seats]=1e3', ['query.filter.seats: invalid_value']],
    ['an instant without its zone', 'filter[startsAt]=gte:2026-10-01T00:00:00', ['query.filter.startsAt: invalid_value']],
    ['a boolean that is not one', 'filter[remote]=yes', ['query.filter.remote: invalid_value']],
    ['a list with a value of another type', 'filter[seats]=in:1,x', ['query.filter.seats: invalid_value']],
    ['a list longer than the limit', 'filter[seats]=in:1,2,3,4', ['query.filter.seats: in_list_too_long']],
    ['between without its two values', 'filter[seats]=between:2', ['query.filter.seats: invalid_value']],
    ['a group inside a group', 'filter[or][0][status]=booked&filter[or][0][remote]=true', ['query.filter: too_deep']],
    ['a path below a field', 'filter[status][gte]=booked', ['query.filter.status: invalid_filter']],
    ['a filter without a field', 'filter[]=booked', ['query.filter: invalid_filter']],
    ['a sort that is not declared', 'sort=price', ['query.sort: unsortable_field']],
    ['every mistake at once', 'filter[password]=x&filter[seats]=gte:two&limit=0', ['query.filter.seats: invalid_value', 'query.limit: invalid_limit']],
  ])('refuses %s', (_label, search, issues) => {
    expect(issuesOf({ ...parseQueryString(search) })).toEqual(issues);
  });

  it('refuses a filter that is not text, and a filter parameter without brackets', () => {
    expect(issuesOf({ filter: { status: { eq: 'booked' } } })).toEqual(['query.filter.status: invalid_filter']);
    expect(issuesOf({ filter: 'status' })).toEqual(['query.filter: invalid_filter']);
    expect(issuesOf({ filter: { seats: 3 } })).toEqual(['query.filter.seats: invalid_filter']);
  });

  it('never quotes a value in an issue', () => {
    try {
      criteriaFrom({ 'filter[seats]': 'gte:secret-value' }, appointments);
    } catch (error) {
      expect(JSON.stringify(error instanceof ValidationError ? error.issues : error)).not.toContain('secret-value');
    }
  });
});

describe('a list route with criteria', () => {
  const rows: AppointmentRow[] = [
    { id: 'a1', status: 'booked', title: 'Annual review', seats: 2, price: '10.5', startsAt: new Date('2026-10-01T08:00:00Z'), cancelledAt: null, remote: false, tenantId: 'acme' },
    { id: 'a2', status: 'confirmed', title: 'Check', seats: 4, price: '9.5', startsAt: new Date('2026-10-02T08:00:00Z'), cancelledAt: null, remote: true, tenantId: 'acme' },
    { id: 'a3', status: 'cancelled', title: 'Remote', seats: 2, price: '100', startsAt: new Date('2026-10-03T08:00:00Z'), cancelledAt: new Date('2026-09-30T08:00:00Z'), remote: true, tenantId: 'globex' },
  ];

  const item = customSchema<{ id: string }>((input) => ({ ok: true, value: { id: String(Reflect.get(Object(input), 'id')) } }), {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  });

  const listAppointments = defineRoute(
    {
      method: 'GET',
      path: '/appointments',
      operationId: 'listAppointments',
      summary: 'List appointments',
      request: { query: criteriaQuerySchema(appointments) },
      responses: { 200: { description: 'A page of appointments.', body: pageSchemaOf(item) } },
      security: ['bearer'],
    },
    ({ query }) => {
      const page = evaluateCriteria(appointments, rows, scoped(query, { kind: 'filter', filter: { tenantId: 'acme' } }, { filter: { tenantId: 'tenantId' } }));

      return { status: 200, body: pageResponse(pageOf(page.items, { total: page.total ?? 0 }), ({ id }) => ({ id })) };
    },
  );

  const call = (search: string) => {
    const request: RawRequest = { params: {}, query: { ...parseQueryString(search) }, headers: {}, body: undefined, raw: undefined };

    return executeRoute(listAppointments, request, { validateResponses: true });
  };

  it('answers the rows the criteria and the scope of the actor keep, in the sort asked', async () => {
    expect(await call('filter[seats]=gte:2&sort=-startsAt')).toMatchObject({ status: 200, body: { items: [{ id: 'a2' }, { id: 'a1' }], total: 2 } });
    expect(await call('filter[or][status]=cancelled&filter[or][remote]=true')).toMatchObject({ body: { items: [{ id: 'a2' }], total: 1 } });
  });

  it('answers 422 naming the filter and a stable code', async () => {
    expect(await call('filter[password]=x&filter[seats]=gte:two')).toMatchObject({
      status: 422,
      body: {
        code: 'VALIDATION_FAILED',
        issues: [
          { path: 'query.filter.seats', code: 'invalid_value' },
          { path: 'query.filter.password', code: 'unknown_field' },
        ],
      },
    });
  });

  it('documents each filter with its operators, the sort as its values, and the page', () => {
    const document = generateOpenApi({ info: { title: 'Appointments', version: '1.0.0' }, routes: [listAppointments] });
    const parameters: unknown = document.paths['/appointments']?.['get']?.['parameters'];
    const names = (Array.isArray(parameters) ? parameters : []).map((parameter: { name: string }) => parameter.name);

    expect(names).toEqual(['filter[status]', 'filter[title]', 'filter[seats]', 'filter[price]', 'filter[startsAt]', 'filter[cancelledAt]', 'filter[remote]', 'sort', 'limit', 'offset', 'cursor']);

    expect(parameters).toContainEqual({
      name: 'filter[startsAt]',
      in: 'query',
      required: false,
      description: 'Filters on `startsAt`, written `<operator>:<value>`; the value alone means `eq`. Operators: gte, lt, between. The value is an ISO 8601 instant with its zone.',
      schema: expect.objectContaining({ type: 'string', 'x-filter-operators': ['gte', 'lt', 'between'], 'x-filter-type': 'instant' }),
    });

    expect(parameters).toContainEqual(
      expect.objectContaining({ name: 'sort', schema: expect.objectContaining({ type: 'array', items: { type: 'string', enum: ['status', '-status', 'seats', '-seats', 'startsAt', '-startsAt', 'id', '-id'] } }) }),
    );
  });

  it('gives the same parameters as a schema to merge into a wider query schema', () => {
    const schema = criteriaParameters(appointments);

    expect(Object.keys(schema['properties'] ?? {})).toContain('filter[status]');
    expect(schema).toMatchObject({ type: 'object', properties: { limit: { maximum: 50, default: 20 } } });
  });
});
