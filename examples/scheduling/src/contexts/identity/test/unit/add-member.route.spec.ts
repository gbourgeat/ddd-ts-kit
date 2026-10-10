import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { AddMemberCommand } from '../../application/commands/add-member/add-member.command.js';
import { AlreadyMemberError } from '../../domain/errors/already-member.error.js';
import { PersonNotRegisteredError } from '../../domain/errors/person-not-registered.error.js';
import { PracticeNotFoundError } from '../../domain/errors/practice-not-found.error.js';
import { UnknownRoleError } from '../../domain/errors/unknown-role.error.js';
import { addMemberRoute } from '../../presentation/http/add-member.route.js';

const params = { practiceId: 'practice-1' };
const body = { personId: 'person-2', role: 'assistant' };

describe('POST /practices/:practiceId/members', () => {
  it('answers 201 when the use case succeeds', async () => {
    const commands = new InMemoryCommandBus().register(AddMemberCommand, { execute: async () => 'add-member-1' });

    const response = await executeRoute(
      addMemberRoute(commands),
      { params, query: {}, headers: {}, body, raw: undefined },
      { validateResponses: true },
    );

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 'add-member-1' });
  });

  it('hands the use case what the client sent', async () => {
    const sent: AddMemberCommand[] = [];

    const commands = new InMemoryCommandBus().register(AddMemberCommand, {
      execute: async (command) => {
        sent.push(command);

        return 'add-member-1';
      },
    });

    await executeRoute(addMemberRoute(commands), { params, query: {}, headers: {}, body, raw: undefined });

    expect(sent).toMatchObject([{ practiceId: 'practice-1', member: { personId: 'person-2', role: 'assistant' } }]);
  });

  it.each([
    ['a body without a person', { role: 'assistant' }],
    ['a body without a role', { personId: 'person-2' }],
    ['a role that is not one of the three', { personId: 'person-2', role: 'patient' }],
  ])('refuses %s with 422', async (_what, malformed) => {
    const commands = new InMemoryCommandBus().register(AddMemberCommand, { execute: async () => 'add-member-1' });

    const response = await executeRoute(addMemberRoute(commands), {
      params,
      query: {},
      headers: {},
      body: malformed,
      raw: undefined,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it.each([
    ['PRACTICE_NOT_FOUND', new PracticeNotFoundError('practice-1')],
    ['PERSON_NOT_REGISTERED', new PersonNotRegisteredError('person-1')],
    ['UNKNOWN_ROLE', new UnknownRoleError('patient')],
    ['ALREADY_MEMBER', new AlreadyMemberError('person-1')],
  ])('answers 422 with the code %s when the use case refuses', async (code, refusal) => {
    const commands = new InMemoryCommandBus().register(AddMemberCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(addMemberRoute(commands), {
      params,
      query: {},
      headers: {},
      body,
      raw: undefined,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code });
  });
});
