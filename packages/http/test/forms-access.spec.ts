import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Actor } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  defineForm,
  defineRoute,
  executeRoute,
  formRoutes,
  withFieldAccess,
  type FieldDecider,
  type FieldQuestion,
  type RawRequest,
  type Route,
} from '../src';

const permissions = {
  enrol: { id: 'school:pupil.enrol' },
  readAddress: { id: 'school:address.read' },
  moveAddress: { id: 'school:address.move' },
  readHealth: { id: 'school:health.read' },
};

const enrolment = z.object({
  schoolId: z.string(),
  pupilId: z.string().optional(),
  name: z.string(),
  address: z.object({ street: z.string(), city: z.string() }),
  health: z.string().optional(),
});

type Enrolment = z.infer<typeof enrolment>;

const body = withFieldAccess(zodSchema(enrolment), {
  address: { read: { permission: permissions.readAddress }, write: { permission: permissions.moveAddress } },
  health: { read: { permission: permissions.readHealth } },
});

const form = defineForm<Enrolment>({
  requires: {
    permission: permissions.enrol,
    subject: (values) => (values.schoolId === undefined ? undefined : { type: 'school', id: values.schoolId }),
    context: (values, actor) => ({ selfService: values.pupilId === actor.id }),
  },
});

const enrol = defineRoute(
  {
    method: 'POST',
    path: '/enrolments',
    operationId: 'enrolPupil',
    summary: 'Enrol pupil',
    request: { body },
    responses: { 204: { description: 'Enrolled.' } },
    security: ['bearer'],
    form,
  },
  () => ({ status: 204 }),
);

/** A secretary enrols in school s-1 and reads addresses; a pupil enrols themselves; a teacher only reads health notes. */
function deciding(asked: FieldQuestion[]): FieldDecider {
  const grants: Readonly<Record<string, readonly string[]>> = {
    sam: [permissions.enrol.id, permissions.readAddress.id],
    tess: [permissions.readHealth.id],
  };

  return async (question) => {
    asked.push(question);

    const { actor, requirement, subject, context } = question;
    const id = 'permission' in requirement ? requirement.permission.id : '';
    const inSchool = typeof subject !== 'object' || (subject !== null && 'id' in subject && subject.id === 's-1');

    return (
      inSchool &&
      ((grants[actor.id] ?? []).includes(id) || (id === permissions.enrol.id && context?.['selfService'] === true))
    );
  };
}

function asking(id: string, query: Record<string, string>): RawRequest {
  const actor: Actor = { id, type: 'user', roles: [], attributes: {} };

  return { params: {}, query, headers: {}, body: undefined, raw: actor };
}

async function formOf(id: string, query: Record<string, string>, asked: FieldQuestion[] = []) {
  const [route] = formRoutes([enrol], { fieldAccess: deciding(asked) });

  return executeRoute(route as Route, asking(id, query), { resolvePrincipal: (raw) => raw });
}

describe('the form of a use case that requires a permission', () => {
  it('is given to who may run the use case, asked about the element and the context the values say', async () => {
    const asked: FieldQuestion[] = [];
    const secretary = await formOf('sam', { schoolId: 's-1' }, asked);
    const pupil = await formOf('pia', { schoolId: 's-1', pupilId: 'pia' });

    expect([secretary.status, pupil.status]).toEqual([200, 200]);

    expect(asked[0]).toMatchObject({
      requirement: { permission: permissions.enrol },
      subject: { type: 'school', id: 's-1' },
      context: { selfService: false },
      recorded: true,
    });

    expect(asked.slice(1).every((question) => !question.recorded)).toBe(true);
  });

  it('is refused with 403 to who may not, who then learns nothing of its fields', async () => {
    const teacher = await formOf('tess', { schoolId: 's-1' });
    const elsewhere = await formOf('sam', { schoolId: 's-2' });
    const forAnother = await formOf('pia', { schoolId: 's-1', pupilId: 'paul' });

    expect([teacher.status, elsewhere.status, forAnother.status]).toEqual([403, 403, 403]);
    expect(JSON.stringify(teacher.body)).not.toContain('health');
  });

  it('is refused to everybody when the application decides nothing', async () => {
    const [route] = formRoutes([enrol]);

    const response = await executeRoute(route as Route, asking('sam', { schoolId: 's-1' }), {
      resolvePrincipal: (raw) => raw,
    });

    expect(response.status).toBe(403);
  });

  it('documents the refusal in the contract of the form route', () => {
    const [route] = formRoutes([enrol]);

    expect(route?.errors).toEqual(['UNAUTHORIZED', 'FORBIDDEN']);
  });
});

describe('an object the caller may see but not set', () => {
  it('is read-only with every field it holds, in JSON Forms and in blocks', async () => {
    const jsonForms = await formOf('sam', { schoolId: 's-1' });
    const blocks = await formOf('sam', { schoolId: 's-1', format: 'blocks' });

    expect(jsonForms.body).toMatchObject({ schema: { properties: { address: { type: 'object', readOnly: true } } } });

    expect(JSON.stringify(blocks.body)).toContain('"name":"address.street"');

    expect(blocks.body).toMatchObject({
      blocks: expect.arrayContaining([
        expect.objectContaining({
          name: 'address',
          readOnly: true,
          blocks: [
            expect.objectContaining({ name: 'address.street', readOnly: true }),
            expect.objectContaining({ name: 'address.city', readOnly: true }),
          ],
        }),
      ]),
    });

    expect(JSON.stringify(jsonForms.body)).toContain(
      '"scope":"#/properties/address/properties/street","i18n":"enrolPupil.address.street","options":{"readonly":true}',
    );
  });

  it('gives back the values asked with, except those of a field the caller does not see', async () => {
    const response = await formOf('sam', { schoolId: 's-1', name: 'Pia', health: 'asthma' });

    expect(response.body).toMatchObject({ data: { schoolId: 's-1', name: 'Pia' } });
    expect(JSON.stringify(response.body)).not.toContain('asthma');
  });
});
