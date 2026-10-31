import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Schema } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  defineRoute,
  executeRoute,
  fieldDeciderOf,
  pageSchemaOf,
  withFieldAccess,
  type RawRequest,
  type Route,
} from '../src';

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

describe('a field reserved to some callers, in an answer of a status the route does not declare', () => {
  const reserved = { id: 'v1', note: 'fragile', secret: 'kept' };

  const readSecrets = { id: 'care:secret.read' };
  const secretSchema = z.object({ id: z.string(), secret: z.string() });

  const secret = withFieldAccess(zodSchema(secretSchema, { io: 'output' }), {
    secret: { read: { permission: readSecrets } },
  });

  const plain = zodSchema(z.object({ id: z.string(), note: z.string() }), { io: 'output' });

  const answering = (status: number, responses: Route['responses']): Route => ({
    ...search,
    responses,
    handle: async () => ({ status, body: reserved }),
  });

  it('falls under the rules of every declared response', async () => {
    const route = answering(206, {
      200: { description: 'A visit.', body: visit },
      203: { description: 'B.', body: secret },
    });

    expect((await executeRoute(route, request, options)).body).toEqual({ id: 'v1' });
  });

  it('falls under the rules of a declared list, item by item', async () => {
    const route = {
      ...answering(206, { 200: { description: 'A page.', body: pageSchemaOf(visit) } }),
      handle: async () => ({ status: 206, body: { items: [reserved] } }),
    };

    expect((await executeRoute(route, request, options)).body).toEqual({ items: [{ id: 'v1', secret: 'kept' }] });
  });

  it('keeps to the rules of its own response when the status is declared', async () => {
    const route = answering(203, {
      200: { description: 'A visit.', body: visit },
      203: { description: 'B.', body: plain },
    });

    expect((await executeRoute(route, request, options)).body).toEqual(reserved);
  });

  it('is left as it is when no declared response reserves anything', async () => {
    const route = answering(206, { 200: { description: 'A visit.', body: plain } });

    expect((await executeRoute(route, request, options)).body).toEqual(reserved);
  });
});

describe('a nested object of a schema with restricted fields', () => {
  const nestedSchema = z.object({ id: z.string(), note: z.object({ id: z.string(), secret: z.string() }) });
  const answer = { id: 'v1', note: { id: 'n1', secret: 'kept' } };

  const reading = (body: Schema<unknown>) =>
    defineRoute(
      {
        method: 'GET',
        path: '/visit',
        operationId: 'readNestedVisit',
        summary: 'A visit.',
        responses: { 200: { description: 'A visit.', body } },
        security: ['bearer'],
      },
      () => ({ status: 200, body: answer }),
    );

  it('is left out whole when the property that holds it is restricted', async () => {
    const whole = withFieldAccess(zodSchema(nestedSchema, { io: 'output' }), {
      note: { read: { permission: readNotes } },
    });

    expect((await executeRoute(reading(whole), request, options)).body).toEqual({ id: 'v1' });
  });

  it('is not reached by a rule on the schema of the nested object, which the answer does not go through', async () => {
    const inner = zodSchema(nestedSchema.shape.note, { io: 'output' });

    withFieldAccess(inner, { secret: { read: { permission: readNotes } } });

    const outer = zodSchema(nestedSchema, { io: 'output' });

    expect((await executeRoute(reading(outer), request, options)).body).toEqual(answer);
  });
});
