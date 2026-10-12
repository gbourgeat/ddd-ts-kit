import { describe, expect, it } from 'vitest';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { RemoveMemberCommand } from '@/contexts/identity/application/commands/remove-member/remove-member.command';
import { PracticeError } from '@/contexts/identity/domain/errors/practice.error';
import { RemoveMemberController } from '@/contexts/identity/presentation/http/practices/remove-member/remove-member.controller';

const params = { practiceId: 'practice-1', personId: 'person-2' };
const body = undefined;

describe('DELETE /practices/:practiceId/members/:personId', () => {
  it('answers 200 when the use case succeeds', async () => {
    const commands = new InMemoryCommandBus().register(RemoveMemberCommand, { execute: async () => 'remove-member-1' });

    const response = await executeRoute(
      controllerRoute(new RemoveMemberController(commands), { guards: 'skip' }),
      { params, query: {}, headers: {}, body, raw: undefined },
      { validateResponses: true },
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'remove-member-1' });
  });

  it('hands the use case what the client sent', async () => {
    const sent: RemoveMemberCommand[] = [];

    const commands = new InMemoryCommandBus().register(RemoveMemberCommand, {
      execute: async (command) => {
        sent.push(command);

        return 'remove-member-1';
      },
    });

    await executeRoute(controllerRoute(new RemoveMemberController(commands), { guards: 'skip' }), {
      params,
      query: {},
      headers: {},
      body,
      raw: undefined,
    });

    expect(sent).toMatchObject([{ practiceId: 'practice-1', personId: 'person-2' }]);
  });

  it.each([
    ['PRACTICE_NOT_FOUND', PracticeError.notFound('practice-1')],
    ['NOT_A_MEMBER', PracticeError.notAMember('person-1')],
    ['LAST_MANAGER', PracticeError.lastManager()],
  ])('answers 422 with the code %s when the use case refuses', async (code, refusal) => {
    const commands = new InMemoryCommandBus().register(RemoveMemberCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(controllerRoute(new RemoveMemberController(commands), { guards: 'skip' }), {
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
