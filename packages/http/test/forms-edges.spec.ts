import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { executionContext } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute, executeRoute, formDocumentsOf, formRoutes, type Route } from '../src';
import { as, bookingForm } from './support/booking';

describe('the edges of a form', () => {
  it('is written for the documentation in the order of the operations, whatever the order of the routes', async () => {
    const formNamed = (operationId: string): Route =>
      defineRoute(
        {
          method: 'POST',
          path: `/${operationId}`,
          operationId,
          summary: operationId,
          request: { body: zodSchema(z.object({ note: z.string() })) },
          responses: { 204: { description: 'ok' } },
          security: false,
          form: {},
        },
        () => ({ status: 204 }),
      );

    const documents = await formDocumentsOf([
      formNamed('cancelVisit'),
      formNamed('amendVisit'),
      formNamed('bookVisit'),
    ]);

    expect(documents.map((document) => document.operation)).toEqual(['amendVisit', 'bookVisit', 'cancelVisit']);
  });

  it('takes options, a widget and a format from its hints, and a condition on several values', async () => {
    const route = defineRoute(
      {
        method: 'POST',
        path: '/visits',
        operationId: 'planVisit',
        summary: 'Plan',
        request: { body: zodSchema(z.object({ mood: z.string(), at: z.iso.date(), note: z.string() })) },
        responses: { 204: { description: 'ok' } },
        security: false,
        form: {
          fields: {
            mood: { widget: 'radio', options: ['calm', 'tense'] },
            at: { widget: 'datetime' },
            note: { visibleWhen: { field: 'mood', in: ['tense'] } },
          },
        },
      },
      () => ({ status: 204 }),
    );

    const [served] = formRoutes([{ ...route, groups: ['VisitRoutes'] }]);
    const response = await executeRoute(served as Route, { ...as(undefined), query: {} }, {});

    expect(served?.groups).toEqual(['VisitRoutes']);

    expect(response.body).toMatchObject({
      schema: { properties: { mood: { enum: ['calm', 'tense'] }, at: { format: 'date-time' } } },
      uischema: {
        elements: [
          { scope: '#/properties/mood', options: { format: 'radio' } },
          { scope: '#/properties/at' },
          { rule: { condition: { scope: '#/properties/mood', schema: { enum: ['tense'] } } } },
        ],
      },
    });
  });

  it('reads its query itself when it is called outside the pipeline', async () => {
    const response = await bookingForm?.handle({
      params: {},
      query: { format: 'blocks' },
      headers: {},
      body: undefined,
      context: {
        requestId: 'r',
        raw: null,
        execution: executionContext({
          correlationId: 'c',
          actor: { id: 'pia', type: 'user', roles: [], attributes: {} },
          origin: 'http',
        }),
      },
    });

    expect(response).toMatchObject({ status: 200, body: { type: 'form' } });
  });
});

describe('the edges of a form, a property whose name holds a dot', () => {
  const dotted = (body: z.ZodObject) =>
    defineRoute(
      {
        method: 'POST',
        path: '/visits',
        operationId: 'planDottedVisit',
        summary: 'Plan',
        request: { body: zodSchema(body) },
        responses: { 204: { description: 'ok' } },
        security: false,
        form: {},
      },
      () => ({ status: 204 }),
    );

  it('refuses the route when the routes are built, naming the property', () => {
    const route = dotted(z.object({ 'address.line1': z.string().max(3) }));

    expect(() => formRoutes([{ ...route, groups: ['VisitRoutes'] }])).toThrow(/holds the property "address\.line1"/);
  });

  it('refuses it in a nested object too', () => {
    const route = dotted(z.object({ address: z.object({ 'line.1': z.string() }) }));

    expect(() => formRoutes([{ ...route, groups: ['VisitRoutes'] }])).toThrow(/holds the property "line\.1"/);
  });
});

describe('the edges of a form, a schema that holds itself', () => {
  it('inlines the items of a list a few levels deep when they hold themselves, so the form schema stands alone', async () => {
    const tree = {
      parse: zodSchema(z.unknown()).parse,
      toJsonSchema: () => ({
        type: 'object',
        properties: { nodes: { type: 'array', items: { $ref: '#/$defs/Node' } } },
        $defs: {
          Node: {
            type: 'object',
            properties: { label: { type: 'string' }, nodes: { type: 'array', items: { $ref: '#/$defs/Node' } } },
          },
        },
      }),
    };

    const route = defineRoute(
      {
        method: 'POST',
        path: '/forests',
        operationId: 'plantForest',
        summary: 'Plant',
        request: { body: tree },
        responses: { 204: { description: 'ok' } },
        security: false,
        form: {},
      },
      () => ({ status: 204 }),
    );

    const [document] = await formDocumentsOf([route]);
    const written = JSON.stringify(document?.jsonForms.schema);
    const inlined = written.split('"items":{"type":"object","properties":{"label"').length - 1;

    expect(written).toContain('"nodes":{"type":"array","items":{"type":"object","properties":{"label"');
    expect(inlined).toBeGreaterThanOrEqual(8);
    expect(inlined).toBeLessThan(32);
  });

  it('describes a schema that holds itself a few levels deep', async () => {
    const tree = {
      parse: zodSchema(z.unknown()).parse,
      toJsonSchema: () => ({
        type: 'object',
        properties: { node: { $ref: '#/$defs/Node' } },
        $defs: { Node: { type: 'object', properties: { label: { type: 'string' }, child: { $ref: '#/$defs/Node' } } } },
      }),
    };

    const route = defineRoute(
      {
        method: 'POST',
        path: '/trees',
        operationId: 'plantTree',
        summary: 'Plant',
        request: { body: tree },
        responses: { 204: { description: 'ok' } },
        security: false,
        form: {},
      },
      () => ({ status: 204 }),
    );

    const [document] = await formDocumentsOf([route]);

    expect(JSON.stringify(document?.blocks)).toContain('node.child.child.child.child.child.child.label');
  });
});
