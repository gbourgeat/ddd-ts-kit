import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { AddMemberCommand } from '@/contexts/identity/application/commands/add-member/add-member.command';
import { AlreadyMember } from '@/contexts/identity/domain/errors/already-member.error';
import { UnknownPractice } from '@/contexts/identity/domain/errors/unknown-practice.error';
import { UnknownRole } from '@/contexts/identity/domain/errors/unknown-role.error';
import { PersonNotRegistered } from '@/contexts/identity/domain/errors/person-not-registered.error';
import { AddMemberController } from '@/contexts/identity/presentation/http/practices/add-member/add-member.controller';

const params = { practiceId: 'practice-1' };
const body = { personId: 'person-2', role: 'assistant' };

describe('POST /practices/:practiceId/members', () => {
  it('answers 201 when the use case succeeds', async () => {
    const commands = new InMemoryCommandBus().register(AddMemberCommand, { execute: async () => 'add-member-1' });

    const response = await executeRoute(
      controllerRoute(new AddMemberController(commands), { guards: 'skip' }),
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

    await executeRoute(controllerRoute(new AddMemberController(commands), { guards: 'skip' }), {
      params,
      query: {},
      headers: {},
      body,
      raw: undefined,
    });

    expect(sent).toMatchObject([{ practiceId: 'practice-1', member: { personId: 'person-2', role: 'assistant' } }]);
  });

  it.each([
    ['a body without a person', { role: 'assistant' }],
    ['a body without a role', { personId: 'person-2' }],
    ['a role that is not one of the three', { personId: 'person-2', role: 'patient' }],
  ])('refuses %s with 422', async (_what, malformed) => {
    const commands = new InMemoryCommandBus().register(AddMemberCommand, { execute: async () => 'add-member-1' });

    const response = await executeRoute(controllerRoute(new AddMemberController(commands), { guards: 'skip' }), {
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
    ['PRACTICE_NOT_FOUND', UnknownPractice.forPractice('practice-1')],
    ['PERSON_NOT_REGISTERED', PersonNotRegistered.forPerson('person-1')],
    ['UNKNOWN_ROLE', UnknownRole.forName('patient')],
    ['ALREADY_MEMBER', AlreadyMember.forPerson('person-1')],
  ])('answers 422 with the code %s when the use case refuses', async (code, refusal) => {
    const commands = new InMemoryCommandBus().register(AddMemberCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(controllerRoute(new AddMemberController(commands), { guards: 'skip' }), {
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
