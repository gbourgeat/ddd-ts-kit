import { parse as parseQueryString } from 'node:querystring';
import { describe, expect, it } from 'vitest';
import { evaluateCriteria, pageOf, scoped } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import {
  criteriaParameters,
  criteriaQuerySchema,
  defineRoute,
  executeRoute,
  pageResponse,
  pageSchemaOf,
  type RawRequest,
} from '../src';
import { generateOpenApi } from '../src/openapi';
import { appointments, type AppointmentRow } from './support/appointments';

const rows: AppointmentRow[] = [
  {
    id: 'a1',
    status: 'booked',
    title: 'Annual review',
    seats: 2,
    price: '10.5',
    startsAt: new Date('2026-10-01T08:00:00Z'),
    cancelledAt: null,
    remote: false,
    tenantId: 'acme',
  },
  {
    id: 'a2',
    status: 'confirmed',
    title: 'Check',
    seats: 4,
    price: '9.5',
    startsAt: new Date('2026-10-02T08:00:00Z'),
    cancelledAt: null,
    remote: true,
    tenantId: 'acme',
  },
  {
    id: 'a3',
    status: 'cancelled',
    title: 'Remote',
    seats: 2,
    price: '100',
    startsAt: new Date('2026-10-03T08:00:00Z'),
    cancelledAt: new Date('2026-09-30T08:00:00Z'),
    remote: true,
    tenantId: 'globex',
  },
];

const item = customSchema<{ id: string }>(
  (input) => ({ ok: true, value: { id: String(Reflect.get(Object(input), 'id')) } }),
  {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
);

const searchAppointments = defineRoute(
  {
    method: 'GET',
    path: '/appointments',
    operationId: 'searchAppointments',
    summary: 'Search appointments',
    request: { query: criteriaQuerySchema(appointments) },
    responses: { 200: { description: 'A page of appointments.', body: pageSchemaOf(item) } },
    security: ['bearer'],
  },
  ({ query }) => {
    const page = evaluateCriteria(
      appointments,
      rows,
      scoped(query, { kind: 'filter', filter: { tenantId: 'acme' } }, { filter: { tenantId: 'tenantId' } }),
    );

    return { status: 200, body: pageResponse(pageOf(page.items, { total: page.total ?? 0 }), ({ id }) => ({ id })) };
  },
);

const call = (search: string) => {
  const request: RawRequest = {
    params: {},
    query: { ...parseQueryString(search) },
    headers: {},
    body: undefined,
    raw: undefined,
  };

  return executeRoute(searchAppointments, request, { validateResponses: true });
};

describe('a list route with criteria', () => {
  it('answers the rows the criteria and the scope of the actor keep, in the sort asked', async () => {
    expect(await call('filter[seats]=gte:2&sort=-startsAt')).toMatchObject({
      status: 200,
      body: { items: [{ id: 'a2' }, { id: 'a1' }], total: 2 },
    });

    expect(await call('filter[or][status]=cancelled&filter[or][remote]=true')).toMatchObject({
      body: { items: [{ id: 'a2' }], total: 1 },
    });
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
    const document = generateOpenApi({
      info: { title: 'Appointments', version: '1.0.0' },
      routes: [searchAppointments],
    });

    const parameters: unknown = document.paths['/appointments']?.['get']?.['parameters'];
    const names = (Array.isArray(parameters) ? parameters : []).map((parameter: { name: string }) => parameter.name);

    expect(names).toEqual([
      'filter[status]',
      'filter[title]',
      'filter[seats]',
      'filter[price]',
      'filter[startsAt]',
      'filter[cancelledAt]',
      'filter[remote]',
      'sort',
      'limit',
      'offset',
      'cursor',
    ]);

    expect(parameters).toContainEqual({
      name: 'filter[startsAt]',
      in: 'query',
      required: false,
      description:
        'Filters on `startsAt`, written `<operator>:<value>`; the value alone means `eq`. Operators: gte, lt, between. The value is an ISO 8601 instant with its zone.',
      schema: expect.objectContaining({
        type: 'string',
        'x-filter-operators': ['gte', 'lt', 'between'],
        'x-filter-type': 'instant',
      }),
    });

    expect(parameters).toContainEqual(
      expect.objectContaining({
        name: 'sort',
        schema: expect.objectContaining({
          type: 'array',
          items: {
            type: 'string',
            enum: ['status', '-status', 'seats', '-seats', 'startsAt', '-startsAt', 'id', '-id'],
          },
        }),
      }),
    );
  });

  it('gives the same parameters as a schema to merge into a wider query schema', () => {
    const schema = criteriaParameters(appointments);

    expect(Object.keys(schema['properties'] ?? {})).toContain('filter[status]');
    expect(schema).toMatchObject({ type: 'object', properties: { limit: { maximum: 50, default: 20 } } });
  });
});
