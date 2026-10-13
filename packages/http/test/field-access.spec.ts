import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Actor } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  Representations,
  defineRoute,
  executeRoute,
  fieldDeciderOf,
  pageSchemaOf,
  streamSchemaOf,
  withFieldAccess,
  type FieldAccessDecisions,
  type FieldPolicy,
  type RawRequest,
  type RouteResponse,
} from '../src/index.js';
import { generateOpenApi } from '../src/openapi.js';

const readNotes = { id: 'care:note.read' };

/** A practitioner edits the notes of their own patients only: a rule about the element. */
const ownPatient: FieldPolicy = {
  name: 'own-patient',
  allows: (actor, subject) =>
    typeof subject === 'object' &&
    subject !== null &&
    'practitionerId' in subject &&
    subject.practitionerId === actor.id,
};

const visitSchema = z.object({ id: z.string(), practitionerId: z.string(), note: z.string() });

const visit = withFieldAccess(zodSchema(visitSchema, { io: 'output' }), {
  note: { read: { permission: readNotes }, write: { policy: ownPatient }, subject: (row) => row },
});

const recording = withFieldAccess(zodSchema(visitSchema.partial({ note: true })), {
  note: { read: { permission: readNotes }, write: { policy: ownPatient }, subject: (row) => row },
});

const VISITS = [
  { id: 'v1', practitionerId: 'pia', note: 'fragile' },
  { id: 'v2', practitionerId: 'paul', note: 'allergic' },
];

/** What a role may do, as the `Access` of an application would answer: the fake counts its questions. */
class RoleAccess implements FieldAccessDecisions {
  asked = 0;

  constructor(private readonly grants: Readonly<Record<string, readonly string[]>>) {}

  async decide(actor: Actor, permission: { readonly id: string }): Promise<{ readonly allowed: boolean }> {
    this.asked += 1;

    return { allowed: actor.roles.some((role) => this.grants[role]?.includes(permission.id) === true) };
  }
}

const clock = { now: () => new Date(Date.UTC(2026, 9, 13)) };

const routes = {
  search: defineRoute(
    {
      method: 'GET',
      path: '/visits',
      operationId: 'searchVisits',
      summary: 'Visits',
      responses: { 200: { description: 'A page.', body: pageSchemaOf(visit) } },
      security: ['bearer'],
      produces: ['application/xml', 'text/csv'],
    },
    () => ({ status: 200, body: { items: VISITS.map((row) => ({ ...row })) } }),
  ),
  exported: defineRoute(
    {
      method: 'GET',
      path: '/visits/export',
      operationId: 'exportVisits',
      summary: 'Export',
      responses: { 200: { description: 'Every visit.', body: streamSchemaOf(visit) } },
      security: ['bearer'],
    },
    () => ({ status: 200, body: streamed() }),
  ),
  record: defineRoute(
    {
      method: 'POST',
      path: '/visits',
      operationId: 'recordVisit',
      summary: 'Record',
      request: { body: recording },
      responses: { 204: { description: 'Recorded.' } },
      security: ['bearer'],
    },
    () => ({ status: 204 }),
  ),
};

async function* streamed(): AsyncIterable<z.infer<typeof visitSchema>> {
  for (const row of VISITS) {
    await Promise.resolve();
    yield row;
  }
}

function as(id: string, ...roles: string[]): RawRequest {
  return { params: {}, query: {}, headers: {}, body: undefined, raw: { id, type: 'user', roles, attributes: {} } };
}

const grants = { doctor: ['care:note.read', 'care:note.write'], assistant: ['care:note.read'] };

function options(access = new RoleAccess(grants)): Parameters<typeof executeRoute>[2] {
  return {
    resolvePrincipal: (raw) => raw,
    fieldAccess: fieldDeciderOf({ access, clock }),
    representations: Representations.standard(),
  };
}

async function text(response: RouteResponse): Promise<string> {
  let written = response.body instanceof Uint8Array ? new TextDecoder().decode(response.body) : '';

  for await (const chunk of response.stream ?? []) {
    written += chunk;
  }

  return written;
}

describe('a field reserved to some callers, in an answer', () => {
  it('is left out for an actor who may not read it, and kept for one who may', async () => {
    const patient = await executeRoute(routes.search, as('rosa', 'patient'), options());
    const assistant = await executeRoute(routes.search, as('ana', 'assistant'), options());

    expect(JSON.parse(await text(patient)).items).toEqual([
      { id: 'v1', practitionerId: 'pia' },
      { id: 'v2', practitionerId: 'paul' },
    ]);

    expect(JSON.parse(await text(assistant)).items[0]).toEqual(VISITS[0]);
  });

  it('is left out in every representation: XML and CSV alike', async () => {
    const xml = await executeRoute(routes.search, { ...as('rosa'), headers: { accept: 'application/xml' } }, options());
    const csv = await executeRoute(routes.search, { ...as('rosa'), headers: { accept: 'text/csv' } }, options());

    expect(await text(xml)).not.toContain('fragile');
    expect(await text(csv)).toBe('id,practitionerId,note\r\nv1,pia,\r\nv2,paul,\r\n');
  });

  it('is left out of each item of a streamed list', async () => {
    const response = await executeRoute(routes.exported, as('rosa', 'patient'), options());

    expect(JSON.parse(await text(response))).toEqual([
      { id: 'v1', practitionerId: 'pia' },
      { id: 'v2', practitionerId: 'paul' },
    ]);
  });

  it('is asked once per element of the page, not once per row', async () => {
    const access = new RoleAccess(grants);

    await executeRoute(routes.search, as('ana', 'assistant'), options(access));

    expect(access.asked).toBe(2);
  });

  it('is left out for everybody when the application decides no field', async () => {
    const response = await executeRoute(routes.search, as('dora', 'doctor'), { resolvePrincipal: (raw) => raw });

    expect(response.body).toEqual({
      items: [
        { id: 'v1', practitionerId: 'pia' },
        { id: 'v2', practitionerId: 'paul' },
      ],
    });
  });
});

describe('a field reserved to some callers, in a request body', () => {
  const body = { id: 'v3', practitionerId: 'dora', note: 'calm' };

  it('is refused with 403, naming the field, to an actor who may not set it', async () => {
    const assistant = await executeRoute(routes.record, { ...as('ana', 'assistant'), body }, options());
    const otherDoctor = await executeRoute(routes.record, { ...as('paul', 'doctor'), body }, options());

    expect(assistant.status).toBe(403);

    expect(JSON.parse(await text(assistant))).toMatchObject({
      code: 'FORBIDDEN',
      detail: 'The field body.note may not be set by this caller.',
    });

    expect(otherDoctor.status).toBe(403);
  });

  it('is accepted from an actor who may set it, and not judged when left out', async () => {
    const doctor = await executeRoute(routes.record, { ...as('dora', 'doctor'), body }, options());

    const assistant = await executeRoute(
      routes.record,
      { ...as('ana', 'assistant'), body: { ...body, note: undefined } },
      options(),
    );

    expect(doctor.status).toBe(204);
    expect(assistant.status).toBe(204);
  });

  it('is judged in the items of a list and in nested objects', async () => {
    const nested = defineRoute(
      {
        method: 'POST',
        path: '/batches',
        operationId: 'recordBatch',
        summary: 'Batch',
        request: { body: pageSchemaOf(visit) },
        responses: { 204: { description: 'Recorded.' } },
        security: ['bearer'],
      },
      () => ({ status: 204 }),
    );

    const response = await executeRoute(nested, { ...as('ana', 'assistant'), body: { items: [body] } }, options());

    expect(JSON.parse(await text(response))).toMatchObject({
      detail: 'The field body.items.0.note may not be set by this caller.',
    });
  });
});

describe('the decider built from the Access of the application', () => {
  const actor: Actor = { id: 'pia', type: 'user', roles: [], attributes: {} };

  it('asks a policy directly, with the time of the clock, and refuses a subject it does not apply to', async () => {
    const decide = fieldDeciderOf({ access: new RoleAccess({}), clock });

    const dated: FieldPolicy = {
      name: 'dated',
      allows: (_actor, _subject, { now }) => ({ allowed: now.getUTCFullYear() === 2026 }),
    };

    const picky: FieldPolicy = { name: 'picky', appliesTo: (subject) => subject === 'mine', allows: () => true };

    expect(await decide(actor, { policy: dated }, undefined)).toBe(true);
    expect(await decide(actor, { policy: picky }, 'yours')).toBe(false);
    expect(await decide(actor, { policy: picky }, 'mine')).toBe(true);
  });
});

describe('the contract of a schema with restricted fields', () => {
  const document = generateOpenApi({ info: { title: 'Care', version: '1' }, routes: Object.values(routes) });

  it('marks each restricted field with what it requires, and no longer lists it as required', () => {
    const schema = JSON.stringify(document);

    expect(schema).toContain(
      '"x-field-access":{"read":{"permission":"care:note.read"},"write":{"policy":"own-patient"}}',
    );

    expect(document.paths['/visits']?.['get']).toMatchObject({
      responses: {
        200: {
          content: {
            'application/json': {
              schema: { properties: { items: { items: { required: ['id', 'practitionerId'] } } } },
            },
          },
        },
      },
    });
  });
});
