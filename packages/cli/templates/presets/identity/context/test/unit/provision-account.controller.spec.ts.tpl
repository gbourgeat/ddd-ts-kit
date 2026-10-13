import { describe, expect, it } from '{{tests.module}}';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { ProvisionAccountController } from '{{alias.context}}/presentation/http/accounts/provision-account/provision-account.controller{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('PUT /accounts/me', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: { displayName: 'Ada L.' }, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/accounts/me');
    expect([response.status, response.body]).toEqual([200, { id: 'subject-ada' }]);
    expect(sent).toMatchObject([{ actor: { id: 'subject-ada' }, profile: { email: 'ada@example.test', displayName: 'Ada L.' } }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: { displayName: '' }, raw: undefined },
      { resolvePrincipal: () => caller },
    );

    expect(response.status).toBe(422);
    expect(sent).toEqual([]);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: ProvisionAccountCommand[] = [];

  const commands = new InMemoryCommandBus().register(ProvisionAccountCommand, {
    execute: async (command) => {
      sent.push(command);

      return 'subject-ada';
    },
  });

  return { route: controllerRoute(new ProvisionAccountController(commands)), sent };
}
