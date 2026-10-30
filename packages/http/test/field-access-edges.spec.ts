import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute, executeRoute, fieldDeciderOf, pageSchemaOf, withFieldAccess, type RawRequest } from '../src';

const readNotes = { id: 'care:note.read' };
const visitSchema = z.object({ id: z.string(), note: z.string() });
const visit = withFieldAccess(zodSchema(visitSchema, { io: 'output' }), { note: { read: { permission: readNotes } } });

const listed = [{ id: 'v1', note: 'fragile' }];

const search = defineRoute(
  {
    method: 'GET',
    path: '/visits',
    operationId: 'searchVisits',
    summary: 'Visits',
    responses: { 200: { description: 'A page.', body: pageSchemaOf(visit) } },
    security: ['bearer'],
  },
  () => ({ status: 200, body: { items: listed } }),
);

const request: RawRequest = {
  params: {},
  query: {},
  headers: {},
  body: undefined,
  raw: { id: 'ana', type: 'user', roles: ['assistant'], attributes: {} },
};

/** Nobody may read a note: whatever the judge is asked, it refuses. */
const nobody = fieldDeciderOf({
  access: { decide: async () => ({ allowed: false }) },
  clock: { now: () => new Date(0) },
});

const options = { resolvePrincipal: (raw: unknown) => raw, fieldAccess: nobody };

describe('a field reserved to some callers, where the answer is not shaped as declared', () => {
  it('is left out of each item that is an object, and a list found in its place is left as it is', async () => {
    const odd = {
      ...search,
      handle: async () => ({ status: 200, body: { items: [{ id: 'v1', note: 'fragile' }, ['v2']] } }),
    };

    const response = await executeRoute(odd, request, options);

    expect(response.body).toEqual({ items: [{ id: 'v1' }, ['v2']] });
  });
});

describe('the contract of a schema with restricted fields, when the schema lists no property', () => {
  it('is left as it is: a bag of values has no field to mark', () => {
    const bag = zodSchema(z.record(z.string(), z.string()));
    const restricted = withFieldAccess(bag, { note: { read: { permission: readNotes } } });

    expect(restricted.toJsonSchema()).toEqual(bag.toJsonSchema());
  });
});
