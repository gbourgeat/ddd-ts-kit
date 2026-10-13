import { describe, expect, it } from '{{tests.module}}';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { RemoveMemberController } from '{{alias.context}}/presentation/http/organisations/remove-member/remove-member.controller{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('DELETE /organisations/:organisationId/members/:accountId', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: { organisationId: 'acme', accountId: 'subject-grace' }, query: {}, headers: {}, body: {}, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/organisations/:organisationId/members/:accountId');
    expect([response.status, response.body]).toEqual([200, { id: 'member-1' }]);
    expect(sent).toMatchObject([{ organisationId: 'acme', accountId: 'subject-grace' }]);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: RemoveMemberCommand[] = [];

  const commands = new InMemoryCommandBus().register(RemoveMemberCommand, {
    execute: async (command) => {
      sent.push(command);

      return 'member-1';
    },
  });

  return { route: controllerRoute(new RemoveMemberController(commands)), sent };
}
