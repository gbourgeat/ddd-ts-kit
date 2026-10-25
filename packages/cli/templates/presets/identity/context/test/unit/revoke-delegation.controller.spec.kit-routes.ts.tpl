import { describe, expect, it } from '{{tests.module}}';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { RevokeDelegationController } from '{{alias.context}}/presentation/http/organisations/revoke-delegation/revoke-delegation.controller{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('DELETE /organisations/:organisationId/delegations/:delegationId', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: { organisationId: 'acme', delegationId: 'delegation-1' }, query: {}, headers: {}, body: {}, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/organisations/:organisationId/delegations/:delegationId');
    expect([response.status, response.body]).toEqual([200, { id: 'delegation-1' }]);
    expect(sent).toMatchObject([{ organisationId: 'acme', delegationId: 'delegation-1' }]);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: RevokeDelegationCommand[] = [];

  const commands = new InMemoryCommandBus().register(RevokeDelegationCommand, {
    execute: async (command) => {
      sent.push(command);

      return 'delegation-1';
    },
  });

  return { route: controllerRoute(new RevokeDelegationController(commands)), sent };
}
