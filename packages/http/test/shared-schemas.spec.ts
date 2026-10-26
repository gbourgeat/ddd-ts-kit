import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ok } from '@ddd-ts-kit/kernel';
import { customSchema, sharedSchema } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { acceptedSchema, defineRoute, pageSchemaOf, type RequestSchemas, type ResponseSpec } from '../src';
import { generateOpenApi } from '../src/openapi';

const slot = z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).meta({ id: 'Slot' });
const appointmentId = z.uuid().meta({ id: 'AppointmentId', description: 'An appointment.' });

// The form a class schema shared under the name of its class takes (`classSchema(PatientDto, { shared: true })`).
const patient = sharedSchema(
  'PatientDto',
  customSchema((input) => ok(input), {
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string' } },
  }),
);

function route(operationId: string, request: RequestSchemas, response?: ResponseSpec) {
  return defineRoute(
    {
      method: 'POST',
      path: `/${operationId}`,
      operationId,
      summary: operationId,
      request,
      responses: { 201: response ?? { description: 'Done.', body: acceptedSchema } },
      security: false,
    },
    () => {
      throw new Error('Only documented here.');
    },
  );
}

const routes = [
  route('book', { body: zodSchema(z.object({ slot, appointmentId })) }),
  route('reschedule', { body: zodSchema(slot) }),
  route('narrow', { body: zodSchema(slot.pick({ startsAt: true })) }),
  route('register', { body: patient }),
  route('rename', { body: patient }),
  route('search', {}, { description: 'A page.', body: pageSchemaOf(patient) }),
  route('browse', {}, { description: 'A page.', body: pageSchemaOf(patient) }),
  route('cancel', { query: zodSchema(z.object({ appointmentId })) }),
];

const document = generateOpenApi({ info: { title: 'Shared', version: '1.0.0' }, routes });

const bodyOf = (operationId: string) =>
  document.paths[`/${operationId}`]?.['post']?.['requestBody'] as { content: { 'application/json': unknown } };

const answerOf = (operationId: string) =>
  (document.paths[`/${operationId}`]?.['post']?.['responses'] as Record<string, unknown> | undefined)?.['201'];

describe('a schema shared by several routes', () => {
  it('lands once in the components, whatever library declared it', () => {
    expect(Object.keys(document.components.schemas)).toEqual([
      'Accepted',
      'AppointmentId',
      'PatientDto',
      'PatientDtoPage',
      'Problem',
      'Slot',
    ]);
  });

  it('is referenced by each route that uses it whole, and inside the schemas that compose it', () => {
    expect(bodyOf('reschedule').content['application/json']).toEqual({ schema: { $ref: '#/components/schemas/Slot' } });

    expect(bodyOf('book').content['application/json']).toMatchObject({
      schema: {
        properties: {
          slot: { $ref: '#/components/schemas/Slot' },
          appointmentId: { $ref: '#/components/schemas/AppointmentId' },
        },
      },
    });

    expect(bodyOf('register')).toEqual(bodyOf('rename'));

    expect(bodyOf('register').content['application/json']).toEqual({
      schema: { $ref: '#/components/schemas/PatientDto' },
    });
  });

  it('is copied, not referenced, once a route keeps only a part of it', () => {
    expect(bodyOf('narrow').content['application/json']).toMatchObject({
      schema: { type: 'object', properties: { startsAt: { type: 'string', format: 'date-time' } } },
    });
  });

  it('answers commands with the Accepted identifier of the platform', () => {
    expect(answerOf('book')).toEqual({
      description: 'Done.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Accepted' } } },
    });

    expect(acceptedSchema.parse({ id: 'a-1', extra: true })).toEqual(ok({ id: 'a-1' }));
    expect(acceptedSchema.parse({ id: 1 }).ok).toBe(false);
  });

  it('pages a shared item under one page component', () => {
    expect(answerOf('search')).toEqual(answerOf('browse'));

    expect(document.components.schemas['PatientDtoPage']).toMatchObject({
      required: ['items'],
      properties: { items: { type: 'array', items: { $ref: '#/components/schemas/PatientDto' } } },
    });
  });

  it('still lists the parameters of a shared request part, one per property', () => {
    const shared = sharedSchema(
      'CancelPath',
      customSchema((input) => ok(input), {
        type: 'object',
        required: ['appointmentId'],
        properties: { appointmentId: { type: 'string', format: 'uuid' } },
      }),
    );

    const cancel = defineRoute(
      {
        method: 'DELETE',
        path: '/appointments/:appointmentId',
        operationId: 'cancelPath',
        summary: 'Cancel',
        request: { params: shared },
        responses: { 204: { description: 'Done.' } },
        security: false,
      },
      () => ({ status: 204 }),
    );

    const parameters = generateOpenApi({ info: { title: 'Path', version: '1' }, routes: [cancel] }).paths[
      '/appointments/{appointmentId}'
    ]?.['delete']?.['parameters'];

    expect(parameters).toEqual([
      { name: 'appointmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
    ]);
  });

  it('keeps a parameter typed by a shared schema as a reference', () => {
    expect(document.paths['/cancel']?.['post']?.['parameters']).toEqual([
      { name: 'appointmentId', in: 'query', required: true, schema: { $ref: '#/components/schemas/AppointmentId' } },
    ]);
  });
});
