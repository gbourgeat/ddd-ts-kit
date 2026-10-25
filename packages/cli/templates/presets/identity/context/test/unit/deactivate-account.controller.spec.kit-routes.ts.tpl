import { describe, expect, it } from '{{tests.module}}';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { DeactivateAccountController } from '{{alias.context}}/presentation/http/accounts/deactivate-account/deactivate-account.controller{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('POST /accounts/me/deactivation', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: {}, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/accounts/me/deactivation');
    expect([response.status, response.body]).toEqual([200, { id: 'subject-ada' }]);
    expect(sent).toMatchObject([{ actor: { id: 'subject-ada' } }]);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: DeactivateAccountCommand[] = [];

  const commands = new InMemoryCommandBus().register(DeactivateAccountCommand, {
    execute: async (command) => {
      sent.push(command);

      return 'subject-ada';
    },
  });

  return { route: controllerRoute(new DeactivateAccountController(commands)), sent };
}
