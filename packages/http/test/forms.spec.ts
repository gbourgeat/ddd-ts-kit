import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute, executeRoute, formDocumentsOf, formRoutes, type Route } from '../src';
import { generateOpenApi } from '../src/openapi';
import { as, book, bookingForm, types } from './support/booking';

async function formFor(id: string | undefined, query: Record<string, string> = {}): Promise<Record<string, unknown>> {
  if (bookingForm === undefined) {
    throw new Error('No form route was built.');
  }

  const response = await executeRoute(bookingForm, as(id, query), {
    resolvePrincipal: (raw) => raw,
    validateResponses: true,
  });

  expect(response.body).not.toHaveProperty('issues');
  expect(response.status).toBe(200);

  return response.body as Record<string, unknown>;
}

describe('a form described by the server', () => {
  it('is served at GET /forms/<operationId>, guarded as the route it describes is documented', () => {
    expect(bookingForm).toMatchObject({
      method: 'GET',
      path: '/forms/bookAppointment',
      operationId: 'bookAppointmentForm',
      security: ['bearer'],
      tags: ['scheduling'],
      errors: ['UNAUTHORIZED'],
    });
  });

  it('describes in JSON Forms the fields, the groups, the conditions and the values given', async () => {
    const { schema, uischema, data } = await formFor('pia');

    expect(data).toEqual({ calendarId: 'c-1' });

    expect(schema).toMatchObject({
      type: 'object',
      required: ['calendarId', 'appointmentTypeId', 'kind', 'startsAt', 'patient'],
      properties: {
        kind: { type: 'string', enum: ['consultation', 'follow-up'] },
        startsAt: { type: 'string', format: 'date-time' },
        patient: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
        internalNote: { type: 'string' },
      },
      allOf: [
        {
          if: { properties: { kind: { enum: ['consultation'] } }, required: ['kind'] },
          then: { required: ['reason'] },
        },
      ],
    });

    expect(uischema).toMatchObject({
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Group',
          i18n: 'bookAppointment.when',
          elements: [
            { type: 'Control', scope: '#/properties/startsAt', i18n: 'bookAppointment.startsAt' },
            { type: 'Control', scope: '#/properties/kind' },
          ],
        },
        { type: 'Control', scope: '#/properties/calendarId' },
        {
          type: 'Control',
          scope: '#/properties/appointmentTypeId',
          options: { lookup: { operation: 'searchAppointmentTypes', method: 'GET', path: '/appointment-types' } },
        },
        {
          type: 'Control',
          scope: '#/properties/reason',
          options: { multi: true },
          rule: { effect: 'SHOW', condition: { scope: '#/properties/kind', schema: { const: 'consultation' } } },
        },
        {
          type: 'Group',
          i18n: 'bookAppointment.patient',
          elements: [
            { scope: '#/properties/patient/properties/name' },
            { scope: '#/properties/patient/properties/phone' },
          ],
        },
        { type: 'Control', scope: '#/properties/tags' },
        { type: 'Control', scope: '#/properties/internalNote' },
      ],
    });
  });
});

describe('a form as a neutral tree of blocks', () => {
  it('describes the same form as a neutral tree of blocks', async () => {
    const tree = await formFor('pia', { format: 'blocks' });

    expect(tree).toMatchObject({
      type: 'form',
      operation: 'bookAppointment',
      method: 'POST',
      path: '/appointments',
      label: 'bookAppointment',
    });

    expect(tree['blocks']).toMatchObject([
      {
        type: 'group',
        name: 'when',
        label: 'bookAppointment.when',
        blocks: [
          { type: 'field', name: 'startsAt', widget: 'datetime', required: true, constraints: { format: 'date-time' } },
          {
            name: 'kind',
            widget: 'select',
            options: [{ value: 'consultation', label: 'bookAppointment.kind.consultation' }, { value: 'follow-up' }],
          },
        ],
      },
      { name: 'calendarId', widget: 'text', required: true, value: 'c-1', constraints: { minLength: 1 } },
      { name: 'appointmentTypeId', lookup: { operation: 'searchAppointmentTypes', path: '/appointment-types' } },
      {
        name: 'reason',
        widget: 'textarea',
        required: false,
        constraints: { maxLength: 500 },
        visibleWhen: { field: 'kind', equals: 'consultation' },
      },
      {
        name: 'patient',
        widget: 'group',
        blocks: [{ name: 'patient.name', label: 'bookAppointment.patient.name' }, { name: 'patient.phone' }],
      },
      { name: 'tags', widget: 'select', multiple: true, options: [{ value: 'urgent' }, { value: 'first-visit' }] },
      { name: 'internalNote', widget: 'text' },
    ]);
  });
});

describe('a form described for the caller who asks', () => {
  it('leaves out a field the caller may not see, and makes read-only one they may see but not set', async () => {
    const patient = await formFor('paul');
    const assistant = await formFor('ana');
    const assistantTree = await formFor('ana', { format: 'blocks' });
    const elsewhere = await formFor('pia', { calendarId: 'c-2' });

    expect(Object.keys(patient['schema'] as object)).toContain('properties');
    expect((patient['schema'] as { properties: object }).properties).not.toHaveProperty('internalNote');
    expect(JSON.stringify(patient['uischema'])).not.toContain('internalNote');
    expect(assistant['schema']).toMatchObject({ properties: { internalNote: { type: 'string', readOnly: true } } });

    expect(JSON.stringify(assistant['uischema'])).toContain(
      '"scope":"#/properties/internalNote","i18n":"bookAppointment.internalNote","options":{"readonly":true}',
    );

    expect(assistantTree['blocks']).toContainEqual(expect.objectContaining({ name: 'internalNote', readOnly: true }));
    expect((elsewhere['schema'] as { properties: object }).properties).not.toHaveProperty('internalNote');
  });

  it('refuses the anonymous caller, an unknown field and an unknown format', async () => {
    const route = bookingForm as Route;
    const anonymous = await executeRoute(route, as(undefined), {});
    const unknown = await executeRoute(route, as('pia', { colour: 'red' }), { resolvePrincipal: (raw) => raw });
    const format = await executeRoute(route, as('pia', { format: 'html' }), { resolvePrincipal: (raw) => raw });

    expect(anonymous.status).toBe(401);
    expect(unknown).toMatchObject({ status: 422, body: { issues: [{ path: 'query.colour', code: 'unknown_field' }] } });
    expect(format).toMatchObject({ status: 422, body: { issues: [{ path: 'query.format', code: 'invalid_format' }] } });
  });

  it('serves the form of a public route to the anonymous caller, its restricted fields left out', async () => {
    const [open] = formRoutes([{ ...book, security: false }, types]);
    const response = await executeRoute(open as Route, as(undefined, { kind: 'consultation' }), {});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { calendarId: 'c-1', kind: 'consultation' } });
    expect(JSON.stringify(response.body)).not.toContain('internalNote');
  });

  it('reads a number and a boolean known in advance as the schema types them', async () => {
    const counted = defineRoute(
      {
        method: 'POST',
        path: '/counts',
        operationId: 'count',
        summary: 'Count',
        request: { body: zodSchema(z.object({ n: z.number(), on: z.boolean(), label: z.string() })) },
        responses: { 204: { description: 'ok' } },
        security: false,
        form: {},
      },
      () => ({ status: 204 }),
    );

    const [route] = formRoutes([counted], { prefix: '/ui/forms/' });

    const response = await executeRoute(
      route as Route,
      { ...as(undefined), query: { n: '3', on: 'true', label: '4' } },
      {},
    );

    expect(route?.path).toBe('/ui/forms/count');
    expect(response.body).toMatchObject({ data: { n: 3, on: true, label: '4' } });
    expect(response.body).toMatchObject({ schema: { properties: { n: { type: 'number' }, on: { type: 'boolean' } } } });
  });
});

describe('the hints of a form', () => {
  const withHints = (hints: object): Route => ({ ...book, form: hints });

  it('are refused when they name a field the body does not hold', () => {
    expect(() => formRoutes([withHints({ fields: { colour: {} } })])).toThrow(DeclarationError);
    expect(() => formRoutes([withHints({ groups: [{ name: 'g', fields: ['nope'] }] })])).toThrow('names "nope"');

    expect(() =>
      formRoutes([withHints({ fields: { reason: { visibleWhen: { field: 'mood', equals: 1 } } } })]),
    ).toThrow('names "mood"');
  });

  it('are refused when they look options up from no GET route', () => {
    expect(() => formRoutes([withHints({ fields: { kind: { lookup: 'searchKinds' } } })])).toThrow(
      'which is no GET route',
    );
  });

  it('are refused on a route without a body', () => {
    expect(() => formRoutes([types, { ...types, operationId: 'other', form: {} }])).toThrow(
      'no request body to describe',
    );
  });
});

describe('the forms in the documentation', () => {
  it('are in the contract, as routes of their own', () => {
    const document = generateOpenApi({
      info: { title: 'Booking', version: '1' },
      routes: [book, types, ...formRoutes([book, types])],
    });

    expect(document.paths['/forms/bookAppointment']?.['get']).toMatchObject({ operationId: 'bookAppointmentForm' });
    expect(document.components.schemas).toHaveProperty('FormBlock');
  });

  it('are written whole, in both formats, for the documentation', async () => {
    const [document] = await formDocumentsOf([types, book]);

    expect(document?.operation).toBe('bookAppointment');
    expect(document?.jsonForms.data).toEqual({});
    expect(JSON.stringify(document?.blocks)).toContain('"name":"internalNote"');
    expect(JSON.stringify(document?.jsonForms.schema)).not.toContain('readOnly');
  });
});
